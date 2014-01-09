//Vivox functions that could be called by or have been called from unity web player
var prevRoom = '';
var session;
var world = "001";
function initUser(player) {
  console.log("intiUser: Start");
  console.log(sessions);
  user = player;
  sessions[room].connect(apikey, tokens[room]);
  $('#rooms').text('Room: ' + room);
  //set publishing options
  var pubOptions = {
    publishAudio: config.mic,
    publishVideo: config.video,
    height: 1,
    width: 1,
    name: user
  };
  publisher = TB.initPublisher(apikey, "publisherContainer", pubOptions);
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
