//Vivox functions that could be called by or have been called from unity web player
var prevRoom = '';
var session;
$(document).ready(function() {
	for (var key in sessionids) {
		//init session, and grab a token so that we can authenticate to it
		console.log("Creating session with id: " + sessionids[key]);
		var session = TB.initSession(sessionids[key]);
		sessions[key] = session;
		sessions[key].addEventListener('sessionConnected', sessionConnectedHandler);
		sessions[key].addEventListener('streamCreated', streamCreatedHandler);
		sessions[key].addEventListener('connectionDestroyed', connectionDestroyedHandler);
		sessions[key].addEventListener('streamDestroyed', streamDestroyedHandler);
	}
	$.ajax({
		"url" : "/token/" +sessionids["union"],
		success: function(data) {
			tokens["union"]= data.session;
		}
	});
	$.ajax({
		"url" : "/token/" +sessionids["management"],
		success: function(data) {
			tokens["management"]= data.session;
		}
	});
	$.ajax({
		"url" : "/token/" +sessionids["middle"],
		success: function(data) {
			tokens["middle"]= data.session;
		}
	});
});
function initUser(player) {
  console.log('initUser: Start');
  user = player;
  sessions[room].connect(apikey, tokens[room]);
  $('#rooms').text('Room: ' + room);
  //set publishing options
  var pubOptions = {
    publishAudio: config.mic,
    publishVideo: config.video,
    name: user
  };
  publisher = TB.initPublisher(apikey, 'publisherContainer', pubOptions);
  publisher.on('streamDestroyed', function(evt) {
    evt.preventDefault();
  });
  publisher.on('streamCreated', function(evt) {
    subscribeToStreams([evt.stream]);
  });
  console.log('OpenTOK url: ' + '/api/' + '001/' + user + '/' + currentRoom);
  console.log('initUser End: ' + player);
}

function RoomChange(newRoom) {
  //This is where the vivox session disconnect and connect code should go.
  console.log('RoomChange: ' + newRoom);
  //If room acutally changes switch
  if (newRoom != currentRoom) {
    unpublish(currentRoom);
    sessions[currentRoom].disconnect();
    sessions[newRoom].connect(apikey, tokens[newRoom]);
    currentRoom = newRoom;
    $('#rooms').text('Room: ' + currentRoom);
  }
  console.log('RoomChange End');
}
//mute myself
function MicMute(mute) {
  console.log('MicMute: ' + mute);
  toggleAudio(!mute);
}
//mute other people
function SetVolume(newVolume) {
  console.log('SetVolume: ' + isMuted);
  $('#video').volume = newVolume;
}
