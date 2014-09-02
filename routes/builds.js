var fs = require('fs'),
express = require('express'),
config = require('../config'),
mongojs = require('mongojs'),
db = mongojs(config.db, ['users', 'worlds']);

var editor = express.Router();

editor.use(function(req,res, next) {
  req.params.id=req.path;
  console.log(req.params.id);
  if(!fs.existsSync(__dirname+"/../builds/"+req.params.id)) {
    res.send(404);
  };
  if(req.method=="GET") {
    console.log("get");
    if (fs.statSync(__dirname + "/../builds/"+req.params.id).isDirectory())
    {
      var f = {'files' : gendir("/../builds/"+req.url)};
      console.log(f);
      res.render('partials/filenav', f);
    }
    else
    {
      next();
    }
  }
  else if(req.method=="PUT") {
    if (req.isAuthenticated())
    {
      var worldid = req.params.id.split('/')[1];
      db.collection('worlds').find({id: worldid}, function(err, docs) {
        if (req.user.identifier == docs[0].user)
        {
          var directory = req.url.substring(0, req.url.lastIndexOf('/'));
          createPath(__dirname + directory, function(done)
          {
            fs.writeFile(__dirname + req.url, req.body.data);
          });
          res.send({status: 'ok'});
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
  }
  else if(req.method=="DELETE") {
    if (req.isAuthenticated())
    {
      var worldid = req.params.id.split('/')[1];
      db.collection('worlds').find({id: worldid}, function(err, docs) {
        if (req.user.identifier == docs[0].user)
        {
          if (fs.statSync(__dirname + "/../builds/"+req.url).isDirectory())
          {
            deleteFolderRecursive(__dirname + req.url);
          }
          else
          {
            fs.unlink(__dirname + "/../builds/"+req.url, function(err)
            {
              if (err)
                 res.send(err);
              else
                res.send({status: 'ok'});
            });
          }
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
  }
});

//helper functions
function gendir(path)
{
	if (fs.existsSync(__dirname + path))
	{
		var dir = fs.readdirSync(__dirname + path);
		var returnVal = [];
		for (var i = 0; i < dir.length; i++)
		{
			var nextVal = {};
			nextVal.path = path + dir[i];
			nextVal.name = dir[i];
			if (fs.statSync(__dirname + path + dir[i]).isDirectory())
			{
				nextVal.isDirectory = true;
			}
			returnVal.push(nextVal);
		}
		return returnVal;
	}
	else
	{
		return null;
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

module.exports=editor;
