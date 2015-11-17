// This file is required by app.js. It sets up event listeners
// for the two main URL endpoints of the application - /create and /chat/:id
// and listens for socket.io messages.


// Export a function, so that we can pass 
// the app and io instances from the app.js file:

module.exports = function(app, express, http){
	var port = process.env.PORT || 8181;
	app.set( "ipaddr", process.env.IPv4||"127.0.0.1" );
	app.set( "port", port );
	app.set( "views", __dirname + "/views" );
	app.set( "view engine", "jade" );
	app.use( express.static( "public", __dirname + "/public" ) );
	app.use( '/components', express.static( __dirname + '/bower_components' ) );
	http.listen( app.get( "port" ), app.get( "ipaddr" ), function () {
		console.log( "Server up and running. Go to http://" + app.get( "ipaddr" ) + ":" + app.get( "port" ) );
	} );
};