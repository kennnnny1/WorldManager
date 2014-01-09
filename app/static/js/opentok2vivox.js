//Vivox functions that could be called by or have been called from unity web player
var prevRoom = '';
var session;
//initial vars

//functino from vivox
function VivoxUnityInit() {
  //If possible this is where the OpenTok init code should go
  console.log('VivoxUnityInit: Start');
  console.log('VivoxJoinedRoom:start');
  GetUnity().SendMessage('VivoxHud', 'VivoxJoinedRoom', '');
  console.log('VivoxJoinedRoom:end');
  //GetUnity().SendMessage("RaiseHand", "VivoxJoinedRoom", "");
  //triggers vivoxLogin event and assigns user name
  GetUnity().SendMessage('VivoxHud', 'onVivoxConnected', 'Connected to Vivox network!');
  console.log('VivoxUnityInit: end');
    //grab session keys from the server, and then initialize the session (the server automatically regenerates the tokens when necessary)
  $.ajax({
    dataType: 'json',
    url: '/api/' + world + '/' + user + '/' + room,
    success: function (data) {
      //copy the data for later use
      globaldata = $.extend({}, data);
      sessions = data.sessions;
      //initalize the sessions
      for (var key in sessions) {
        console.log('Key: ' + key + ' data: ' + data.sessions[key].sessionId);
        var session = TB.initSession(data.sessions[key].sessionId);
        sessions[key] = session;
        sessions[key].addEventListener('sessionConnected', sessionConnectedHandler);
        sessions[key].addEventListener('streamCreated', streamCreatedHandler);
        sessions[key].addEventListener('connectionDestroyed', connectionDestroyedHandler);
        sessions[key].addEventListener('streamDestroyed', streamDestroyedHandler);
      }
      console.log("Joining:" + room);
    }
  });
}

function VivoxLogin(player) {
  console.log("VivoxLogin: Start");
  user = player;
  sessions[room].connect(globaldata.apikey, globaldata.tokens[room]);
  $('#rooms').text('Room: ' + room);
  //set publishing options
  var pubOptions = {
    publishAudio: config.mic,
    publishVideo: config.video,
    height: 1,
    width: 1,
    name: user
  };
  publisher = TB.initPublisher(globaldata.apikey, "publisherContainer", pubOptions);
  console.log('OpenTOK url: ' + '/api/' + '001/' + user + '/' + currentRoom);
  console.log('VivoxLoginEnd: ' + player);
}

function SwitchToChannel(newChannel) {
  //This is where the vivox session disconnect and connect code should go.
  prevRoom = currentRoom;
  console.log('prevRoom: ' + prevRoom);
  console.log('SwitchToChannel: ' + newChannel);
  //Determine if there is a new room
  GetUnity().SendMessage('VivoxHud', 'UpdateCurrentChannel', newChannel);
  if (newChannel == 'sip:confctl-592@regp.vivox.com') {
    console.log('Management: room3');
    currentRoom = 'room3';
  }
  if (newChannel == 'sip:confctl-593@regp.vivox.com') {
    console.log('Union: room1');
    currentRoom = 'room1';
  }
  if (newChannel == 'sip:confctl-591@regp.vivox.com') {
    console.log('Negotiation: room2');
    currentRoom = 'room2';
  }
  //If room acutally changes switch
  if (prevRoom != currentRoom) {
    unpublish(prevRoom);
    sessions[prevRoom].disconnect();
    sessions[currentRoom].connect(globaldata.apikey, globaldata.tokens[currentRoom]);
    $('#rooms').text('Room: ' + currentRoom);
  }
  console.log('SwitchToChannelComplete');
}

function installLocation() {
  console.log('installLocation');
}
function VivoxInstall() {
  console.log('VivoxInstall');
}
function vivoxCompletedLogin(Response) {
  console.log('vivoxCompletedLogin: ' + Response);
}
function ParticipantAdded(event) {
  console.log('ParticipantAdded: ' + event);
}
function ParticipantRemoved(event) {
  console.log('ParticipantRemoved: ' + event);
}
function ParticipantUpdated(event) {
  console.log('ParticipantUpdated: ' + event);
}
function VivoxCreateChannel(channelName) {
  console.log('VivoxCreateChannel: ' + channelName);
}
function vivoxChannelCreate(Response) {
  console.log('vivoxChannelCreate: ' + Response);
}
function VivoxJoinChannel(channelURI, fontId) {
  console.log('VivoxJoinChannel: ' + channelURI + ' fintId: ' + fontId);
}
function VivoxLogout(channelURI) {
  console.log('VivoxLogout: ' + channelURI);
  //added commented out vivox onvivoxlogout
  GetUnity().SendMessage('VivoxHud', 'onVivoxLogout');
}
function vivoxCompletedLogout(Response) {
  console.log('vivoxCompletedLogout: ' + Response);
}
//mute myself
function VivoxMicMute(mute) {
  console.log('VivoxMicMute: ' + mute);
  toggleAudio(!mute);
}
function vivoxMicMuteResult(response) {
  console.log('vivoxMicMuteResult: ' + response);
}
function VersionCheck(event) {
  console.log('VersionCheck event' + event);
}
function vivoxConnected(Event) {
  console.log('vivoxConnected: ' + Event);
}
//mute other people
function HandleMuting(isMuted) {
  console.log('HandleMuting: ' + isMuted);
  $('audio, video').each(function() {
    if(isMuted) {
      $(this).pause();
    }
    else {
      $(this).play();
    }
  });
}
