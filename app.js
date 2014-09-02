var express = require('express')
  , bodyParser = require('body-parser')
  , multiparty = require('connect-multiparty')
  , cookieParser = require('cookie-parser')
  , methodOverride = require('method-override')
  , morgan = require('morgan')
  , errorHandler = require('errorhandler')
  , serveStatic = require('serve-static')
  , session = require('express-session')
  , util = require('util')
  , cons = require('consolidate')
  , Handlebars = require('handlebars')
  , request = require('request')
  , app = express()
  , server = require('http').createServer(app)
  , fs = require('fs-extra')
  , passport = require('passport')
  , GoogleStrategy = require('passport-google').Strategy
  , path = require('path')
  , config = require('./config')
  , net = require('net')
  , mongojs = require('mongojs')
  , db = mongojs(config.db, ['users', 'worlds'])
  , MongoStore = require('connect-mongo')(session)
  , sessionStore = new MongoStore({db: 'Session'})
  , defaultHandlebars = require('./defaultHandlebars')
  , OpenTok = require('opentok')
  , opentok = new OpenTok(config.opentokapi, config.opentoksecret)
  , io = require('socket.io').listen(server);
var secret = 'keyboard cat';
passport.serializeUser(function(user, done) {
	done(null, user);
});

passport.deserializeUser(function(obj, done) {
	done(null, obj);
});

passport.use(new GoogleStrategy({
	returnURL: config.url + ':' + config.port + '/auth/google/return',
	realm: config.url + ':' + config.port
},

function(identifier, profile, done) {
	process.nextTick(function() {
		db.collection('users').find({'identifier' : identifier}, function(err, docs) {
			if (docs.length != 0) //if the user is alraedy in the db, just return the user
			{
				profile = docs[0];
				return done(null, profile);
			}
			else //otherwise create a new user to add to the db and return the new user
			{
				profile.identifier = identifier;
				db.collection('users').save(profile);
				return done(null, profile);
			}
		});
	});
}));


function isAdmin(email,done){
    var returnVal = false;

    db.collection("users").findOne({"emails":{"$in":[{"value":email}]}},function(err,docs){
        if(docs.isAdmin){
            returnVal = true
        }
        return done(returnVal);
    })

}


function deleteFolderRecursive(path) {
    var files = [];
    if (fs.existsSync(path)) {
	files = fs.readdirSync(path);
        files.forEach(function(file, index) {
            var curPath = path + '/' + file;
            if (fs.statSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

function createPath(path, done)
{
	if (path[path.length - 1] == '/')
	{
		path = path.substring(0, path.length - 1);
	}
	if (fs.existsSync(path))
	{
		done();
	}
	else
	{
		createPath(path.substring(0, path.lastIndexOf('/')), function(err) {
			fs.mkdir(path, function(err) {
				if (err) throw err;
				done();
			});
		});

	}
}
if(!process.env.NODE_ENV || process.env.NODE_ENV == 'development') {
	console.log('Using devlopment version');
	app.use(morgan('dev'));
	app.use(errorHandler({
		dumpExceptions: true,
		showStack: true
	}));
}

// set .hbs as the default extension
app.set('view engine', 'hbs');
app.engine('hbs', cons.handlebars);
app.set('views', __dirname + '/views');
app.set('view options', {layout: false});
app.use('/builds', express.static(__dirname + '/builds'));
app.use(serveStatic(__dirname + '/static'));
app.use(cookieParser());
app.use(bodyParser());
app.use(multiparty());
app.use(methodOverride());
app.use(session({ secret: secret, store: sessionStore, cookie: { path: '/', httpOnly: false, maxAge: 14400000 }}));
app.use(passport.initialize());
app.use(passport.session());
app.use(defaultHandlebars);
//handlebars partials and helpers
var partialsDir = __dirname + '/views/partials';

//grab all the files in the partials directory
fs.readdir(partialsDir, function(err, files) {
	for (var filename in files)
	{
		filename = files[filename];
		//check that the file is a handlebars file
		var filetype = path.extname(filename);
		console.log('registering file: ' + filename);
		if (filetype == '.hbs') {
			var name = path.basename(filename, filetype);
			var template = fs.readFileSync(partialsDir + '/' + filename, 'utf8');
			console.log(name);
			Handlebars.registerPartial(name, template);
		}
	}
});

Handlebars.registerHelper('embed', function(val, data) {
	var output;
	if (fs.existsSync(val))
	{
		output = fs.readFileSync(val, 'utf8');
		output = Handlebars.compile(output);
		return output(this);
	}
	else
	{
		return fs.readFileSync(__dirname + '/views/partials/404.hbs');
	}
  });


Handlebars.registerHelper('compare', function(lvalue, rvalue, options) {

    if (arguments.length < 3) {
        throw new Error("Handlerbars Helper 'compare' needs 2 parameters");
	}

    operator = options.hash.operator || '==';

    var operators = {
        '==': function(l, r) { return l == r; },
        '===': function(l, r) { return l === r; },
        '!=': function(l, r) { return l != r; },
        '<': function(l, r) { return l < r; },
        '>': function(l, r) { return l > r; },
        '<=': function(l, r) { return l <= r; },
        '>=': function(l, r) { return l >= r; },
        'typeof': function(l, r) { return typeof l == r; }
    };

    if (!operators[operator]) {
        throw new Error("Handlerbars Helper 'compare' doesn't know the operator " + operator);
	}

    var result = operators[operator](lvalue, rvalue);

    if (result) {
        return options.fn(this);
    } else {
        return options.inverse(this);
    }
});




app.get('/',function(req, res){
    db.collection('worlds').find({'featured':true}, function(err,docs){
        req.hbs.preview = docs;
        req.hbs.path = partialsDir + '/featured.hbs';
        res.render('root', req.hbs);
    });
});

app.get('/home', function(req, res) {
	db.collection('worlds').find(function(err, docs) { //grab the info from mongodb about the worlds that we have to render, and then display them on the page
		req.hbs.preview = docs;
		req.hbs.path = partialsDir + '/home.hbs';
		res.render('root', req.hbs);
	});

});

app.get('/all', function(req, res) {
    db.collection('worlds').find(function(err, docs) { //grab the info from mongodb about the worlds that we have to render, and then display them on the page
        req.hbs.preview = docs;
        req.hbs.path = partialsDir + '/all.hbs';
        res.render('root', req.hbs);
    });

});



app.get('/admin',function(req, res){
    console.log(req)

    var email = req.user.emails[0]

    isAdmin("brianjhillman@gmail.com", function(isAdmin){
        if(isAdmin){
            db.collection('worlds').find(function(err , docs){
                req.hbs.preview = docs;
                req.hbs.path = partialsDir + '/admin.hbs';
                res.render('root', req.hbs)
            });
        }else{
            req.hbs.path = partialsDir + '/401.hbs';
            res.render('root', req.hbs);
        }
});
    })


app.get('/world/:id', function(req, res) {
    //we're encoding uri's now so they have to be decoded.
    req.params.id = decodeURIComponent(req.params.id)
	db.collection('worlds').find({id: req.params.id}, function(err, docs) {
		if (docs.length != 0)
		{
			req.hbs.world = docs[0];
			if (req.isAuthenticated())
			{
				if (req.user.identifier == req.hbs.world.user)
				{
					req.hbs.isMine = true;
				}

			}
			if (fs.existsSync(__dirname + '/builds/'+ req.params.id + '/world.hbs')) //switch to custom hbs if they made one
			{
				req.hbs.path = __dirname + '/builds/'+ req.params.id + '/world.hbs';
			}
			console.log(req.hbs);
			req.hbs.identifier = req.params.id;
			res.render('root', req.hbs);
		}
		else
		{
			req.hbs.path = partialsDir + '/404.hbs';
			res.render('root', req.hbs);
		}
	});

});

app.post('/admin', function(req,res,next){
    if(req.isAuthenticated){
        db.worlds.update({},{$set:{'featured':false}},{multi:true});
        for(change in req.body){
                db.worlds.update({"_id": new db.ObjectId(change)},{$set:{'featured':true}});
        }
        res.redirect("/")
    }
});

app.post('/', function(req, res, next) {
	if (req.isAuthenticated())
	{
		var extension = path.extname(req.files.build.name);
		if (extension == '.unity3d') {
			newWorld = req.body;
			if(req.body.nickname.match(/^[^<>%$/? ]*$/)==null) res.send("Invalid url nickname"); //check if the url nickname has any invalid characters
			newWorld.id = req.body.nickname;
			fs.exists(__dirname+ '/builds/' + newWorld.id, function (exists) {
				if(exists) {
					res.send('World already exits with that name!');
				} else {
					newWorld.world = '/builds/'+ newWorld.id + '/'+ req.files.build.name;
					newWorld.img = '/builds/'+ newWorld.id + '/img/'+ req.files.image.name;
					newWorld.href = '/world/'+ newWorld.id;
					newWorld.user = req.user.identifier;
					createPath(__dirname + '/builds/'+ newWorld.id + '/img/', function(done) {
						fs.readFile(req.files.build.path, function(err, data) {

							fs.writeFile(__dirname + '/builds/'+ newWorld.id + '/'+ req.files.build.name, data, function(err) {

								if (err) throw err;
								res.redirect('/');
							});
						});
						fs.readFile(req.files.image.path, function(err, data) {

							fs.writeFile(__dirname + '/builds/'+ newWorld.id + '/img/'+ req.files.image.name, data, function(err) {
								if (err) throw err;
							});
						});
					});
                    newWorld.featured = false;
					newWorld.opentokSessions = {};

					opentok.createSession({'location': '127.0.0.1'}, function(err, result) {
						newWorld.opentokSessions.management = result.sessionId;
						opentok.createSession({'location':'127.0.0.1'}, function(err, result) {
							newWorld.opentokSessions.union = result.sessionId;
							opentok.createSession({'location' : '127.0.0.1'}, function(err, result) {
								newWorld.opentokSessions.middle = result.sessionId;
								db.collection('worlds').save(newWorld);
							});
						});
					});
				}
			});
		}
		else
		{
			res.send('Invalid data file');
		}
	}
	else
	{
		res.redirect('/login');
	}
});

//create a world from one of the supported templates
app.post('/template', function(req, res, next) {
    if(req.files.build.name.length > 0){
        res.redirect("/")
        return;
    }

  if(req.isAuthenticated()) {
    var templateName = req.body.templateName;
    fs.exists(__dirname+'/buildTemplates/'+templateName, function (exists) {
      if(exists) {
        //TODO: make this into a more generic function for just copying folders
        fs.copy(__dirname+'/buildTemplates/'+templateName, __dirname+'/builds/'+req.body.nickname, function(err){
          if(err) res.send(err);
          var newWorld = req.body;

          newWorld.id = req.body.nickname;

          newWorld.world = '/builds/'+ newWorld.id + '/WebPlayer.unity3d';

          newWorld.img = '/builds/'+ encodeURIComponent(newWorld.id) + '/img/logo.png';
          newWorld.href = '/world/'+ encodeURIComponent(newWorld.id);
          newWorld.user = req.user.identifier;
            newWorld.featured = false;
          newWorld.opentokSessions = {};
          opentok.createSession({location: '127.0.0.1'}, function(err, result) {
            newWorld.opentokSessions.management = result.sessionId;
            opentok.createSession({location: '127.0.0.1'}, function(err, result) {
              newWorld.opentokSessions.union = result.sessionId;
              opentok.createSession({location: '127.0.0.1'}, function(err, result) {
                newWorld.opentokSessions.middle = result.sessionId;
                console.log(newWorld);
                db.collection('worlds').save(newWorld, function(err) {
                  res.redirect('/');
                });
              });
            });
          });
        });
      } else {
        res.send('Invalid template selected.');
      }
    });
  } else {
    res.redirect('/login');
  }
});

app.get('/auth/google', passport.authenticate('google', { failureRedirect: '/login' }));

app.get('/auth/google/return', function(req, res, next) {
  passport.authenticate('google', function(err, user, info) {
    // This is the default destination upon successful login.
    var redirectUrl = '/';

    if (err) { return next(err); }
    if (!user) { return res.redirect('/'); }

    // If we have previously stored a redirectUrl, use that,
    // otherwise, use the default.
    if (req.session.redirectUrl) {
      redirectUrl = req.session.redirectUrl;
      req.session.redirectUrl = null;
    }
    req.logIn(user, function(err) {
      if (err) { return next(err); }
    });
    res.redirect(redirectUrl);
  })(req, res, next);
});



app.get('/myworlds', function(req, res, next) {
		if (req.isAuthenticated())
		{
			db.collection('worlds').find({'user' : req.user.identifier}, function(err, docs) {
				req.hbs.preview = docs;
				res.render('root', req.hbs);
			});
		}
		else
		{
			res.render('root', req.hbs);
		}
});

app.get('/logout', function(req, res , next) {
	req.logout();
	res.redirect('/');
});
app.get('/editworld/:id', function(req, res, next) {
	if (req.isAuthenticated())
	{
		var query = {
			'id' : req.params.id,
			'user' : req.user.identifier
		};
		db.collection('worlds').find(query, function(err, docs) {
			req.hbs.preview = docs[0];
			res.render('root', req.hbs);
		});
	}
	else
	{
		res.redirect('/login');
	}
});
app.post('/editpage/:id', function(req, res, next) {
	if (req.isAuthenticated())
	{
		db.collection('worlds').find({id: req.params.id}, function(err, docs) {
			if (req.user.identifier == docs[0].user)
			{
				console.log(req.files);
			}
			else
			{
				res.send(403);
			}
		});
	}
	else
	{
		res.send(403);
	}
});
app.get('/editpage/:id', function(req, res, next) {
	if (req.isAuthenticated())
	{
		db.collection('worlds').find({id: req.params.id}, function(err, docs) {
			if (docs[0].user && req.user.identifier == docs[0].user)
			{
				fs.exists(__dirname + '/builds/'+ req.params.id + '/world.hbs', function(exists)
				{
					if (!exists)
					{
						//ensure the proper path exists, and copy the file to it
						createPath(__dirname + '/builds/'+ req.params.id, function() {fs.createReadStream(partialsDir + '/world.hbs').pipe(fs.createWriteStream(__dirname + '/builds/'+ req.params.id + '/world.hbs'))});
					}
				});
				req.hbs.pathToPartial = config.url + ':'+ config.port + '/builds/'+ req.params.id + '/world.hbs';
				req.hbs.identifier = req.params.id;
				res.render('root', req.hbs);
			}
			else
			{
				res.send(403);
			}
		});
	}
	else
	{
		res.send(403);
	}
});
app.post('/edit/:id', function(req, res, next) {
	if (!req.isAuthenticated())
	{
		return;
	}
	var query = {
		'id' : req.params.id,
		user: req.user.identifier
	};
	db.collection('worlds').update(query, {$set: req.params});
});
//generic handler for static handlebars pages
app.get('/:id', function(req, res, next) {
	res.render('root', req.hbs);
});
app.get('/deleteworld/:id', function(req, res, next) {
	if (!req.isAuthenticated())
	{
		res.send(403);
		return;
	}
	var query = {
		'id' : req.params.id,
		'user' : req.user.identifier
	};
	db.collection('worlds').find(query, function(err, docs) {
		deleteFolderRecursive(__dirname + '/builds/' + docs[0].id);
		deleteFolderRecursive(__dirname + '/img/' + docs[0].id);
	});
	db.collection('worlds').remove(query);
	res.redirect('/myworlds');
});

app.post('/editprofile', function(req, res, next) {
	if (!req.isAuthenticated())
	{
		res.redirect('/login');
		return;
	}
	var query = {
		'identifier' : req.user.identifier,
		'name' : {
			'givenName' : req.body.givenName,
			'familyName' : req.body.familyName
		},
		'isPublic' : req.body.isPublic,
		'displayName' : req.body.displayName,
		'emails' : [{'value' : req.body.email}]
	};
	db.collection('worlds').update({'identifier': req.user.identifier}, {$set: query });
	res.redirect('/myprofile');
});
var tokens = {};
var sessions = {};
app.get('/token/:sessionid', function(req, res, next) {
	//43200000 is 12 hours in milliseconds i.e. the time for a token to expire in milliseconds
	if (tokens[req.params.sessionid] != null && (tokens[req.params.sessionid].timestamp - new Date().getTime()) > -43200000)
	{
		console.log(tokens[req.params.sessionid].timestamp - new Date().getTime());
		res.send(tokens[req.params.sessionid]);
	}
	else
	{
		tokens[req.params.sessionid] = {};
		tokens[req.params.sessionid].session = opentok.generateToken(req.params.sessionid, {
			role: "publisher"
		});
		tokens[req.params.sessionid].timestamp = new Date().getTime();
		res.send(tokens[req.params.sessionid]);
	}
});

app.use('/builds', require('./routes/builds'));
var port = config.port;
console.log('WorldManager now listening on port:' + port);
server.listen(port);

io.sockets.on('connection', function(socket) {
	socket.on('generateToken', function(data, fn) {
		//43200000 is 12 hours in milliseconds i.e. the time for a token to expire in milliseconds
		if (tokens[data.session] != null && (tokens[data.session].timestamp - new Date().getTime()) > -43200000)
		{
			fn(tokens[data.session]);
		}
		else
		{
			tokens[data.session] = {};
			tokens[data.session].session = opentok.generateToken({session_id: data.session});
			tokens[data.session].timestamp = new Date().getTime();
			fn(tokens[data.session]);
		}
		console.log('Sent token: ' + tokens[data.session]);
	});
});
