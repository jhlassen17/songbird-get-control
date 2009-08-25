if (typeof(songbird_GET_control) == "undefined") {
	var songbird_GET_control = {
		log: function(msg) {
			var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
			consoleService.logStringMessage("songbirdServer: " + msg)
		},
	};
}

songbird_GET_control.controller = function(){
	var _core = null;
	var log = songbird_GET_control.log;
	var core = function() {
		if(_core == null) {
			_core = Cc["@songbirdnest.com/Songbird/Mediacore/Manager;1"].getService(Ci.sbIMediacoreManager);
		}
		return _core;
	};

	var ctl = {
		play: function() {
			core().playbackControl.play();
		},

		next: function() {
			core().sequencer.next();
		},

		prev: function() {
			core().sequencer.previous();
		},

		pause: function() {
			core().playbackControl.pause();
		},

		playpause: function() {
			var c = core();
			log("play status is: " + c.status.state);
			if(c.status.state == 1) { // playing
				c.playbackControl.pause();
			} else {
				c.playbackControl.play();
			}
		},
	};
	return ctl;
}();

songbird_GET_control.server = (function(){
	var log = songbird_GET_control.log;
	var controller = songbird_GET_control.controller;
	var server = {
		_id: Math.round(Math.random() * 1000),
		_socket: null,
		port: 50136,
		ver: "0.1",

		start: function() {
			log(server);
			server.port = Application.prefs.get("extensions.GET-control.port").value,
			log("port: " + server.port);
			log(server._listener);
			if(server._socket) server.stop();

			server._listener._server = server;
			server._socket = Components.classes["@mozilla.org/network/server-socket;1"].createInstance(Components.interfaces.nsIServerSocket);
			server._socket.init(server.port, true, -1); // loopback only
			server._socket.asyncListen(server._listener);
			log("Server started successfully. Listening to port " + server.port);
			log(server._socket);
			log(server._listener);
		},

		stop: function() {
			if(server._socket) {
				log("Closing socket");
				server._socket.close();
			}
			server._socket = null;
		},


		/**
		* An object implementing nsIServerSocketListener
		*/
		_listener: {
			_httpGetRegExp: new RegExp("^GET [^ ]+ HTTP/\\d+.\\d+$"),

			onSocketAccepted: function(serverSocket, transport)
			{
				log("onSocketAccepted");
				var istream = transport.openInputStream(transport.OPEN_BLOCKING, 0, 0);
				var ostream = transport.openOutputStream(transport.OPEN_BLOCKING, 0, 0);
				var sis = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
				sis.init(istream);

				var request = "";
				var buffer = "";
				var n = 0; // so that we don't hang; XXX is there a better way?

				// read the request - everything before END_OF_HEADER. Any text after that
				// is considered junk and is not read.
				var CRLF = "\r\n", END_OF_HEADER = CRLF + CRLF;
				var lastThreeReadChars = "";
				var headerRead = false;
				while(transport.isAlive() && ++n < 10000 && !headerRead) {
					buffer = sis.read(-1);
					if(buffer.length == 0)
						continue;

					var extendedString = lastThreeReadChars + buffer;
					var sepIdx = extendedString.indexOf(END_OF_HEADER);
					if(sepIdx == -1) {
						request += buffer;
						lastThreeReadChars = extendedString.substr(-3, 3);
					} else {
						request += buffer.substr(0, sepIdx + END_OF_HEADER.length - lastThreeReadChars.length);
						headerRead = true;
					}
				}

				sis.close();

				// write |str| to ostream
				var write = function(str) {
					return ostream.write(str, str.length);
				}

				try { // todo: test various errors handling
					if(!headerRead) {
						log("timeout");
						log("read " + request.length + " bytes: " + request + 
														 "; headerRead=" + headerRead + 
														 "; isAlive=" + transport.isAlive() + 
														 "; n=" + n);
						write("HTTP/1.1 408 Request Time-out" + END_OF_HEADER);
					} else {
						server.GET(request, ostream);
						write("HTTP/1.1 200 OK" + CRLF +
									"Content-type: text/plain" + CRLF + CRLF +
									"Songbird server #" + server._id + ".");
					}
				} finally {
					ostream.close();
				}
				log("request processed successfully");
			},
		
			onStopListening: function(serverSocket, status) {
			}
		},


		GET: function(req, ostream) {
			var CRLF = "\r\n", OK = "OK", ver = server.ver;
			var outString;

			// helpers
			var o = {
				req: req, // parsed request

				// basic
				stream: ostream,
				write: function(s) { return server.stream.write(s, s.length); },

				fail: function(reason) {
					server.write("FAIL");
					if(reason) server.write(": " + reason);
				}
			};
			log("REQUEST: " + req);
			var command = req.match(/GET \/ctl\/([^ ]+) /)[1];
			log("GOT ctl command: " + command);
			controller[command]();
		},
	};
	return server;
})();


window.addEventListener("load", songbird_GET_control.server.start, false);
window.addEventListener("unload", songbird_GET_control.server.stop, false);

