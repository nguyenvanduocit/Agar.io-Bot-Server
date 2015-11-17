var express = require( 'express' );
var app = express();
var http = require( 'http' ).createServer( app );
var io = require( "socket.io" )( http );
var uuid = require( 'node-uuid' );
var _ = require( 'underscore' )._;
var backbone = require( 'backbone' );
var request = require( 'request' );
/**
 * Rounting
 */
require( './config' )( app, express, http );
require( './routes' )( app, io );

var MusicEngine = {};

MusicEngine.Collections = {};
MusicEngine.Models = {};
MusicEngine.pubsub = {};
_.extend( MusicEngine.pubsub, backbone.Events );

MusicEngine.Collections.Song = backbone.Collection.extend( {} );
MusicEngine.Collections.Client = backbone.Collection.extend( {} );
MusicEngine.Collections.Room = backbone.Collection.extend( {} );
MusicEngine.Models.Message = backbone.Model.extend( {
    defaults: {
        'username': 'un-username',
        'msg': 'un-msg'
    }
} );
MusicEngine.Models.Room = backbone.Model.extend( {
    defaults: {
        'id': '',
        'cells':null,
        'clients':new MusicEngine.Collections.Client()
    },
    findWhereClient:function(attributes){
        var clients = this.get('clients');
        return clients.findWhere(attributes);
    },
    addClient:function(client) {
        var clients = this.get('clients');
        return clients.add(client);
    },
    removeClient:function(client){
        var clients = this.get('clients');
        return clients.remove(client);
    },
    clientCount:function(){
        var clients = this.get('clients');
        return clients.length;
    }
} );

MusicEngine.Models.Client = backbone.Model.extend( {
    defaults: {
        'name': 0,
        'cellId':''
    }
} );

var MusicEngineApplication = {
    initialize: function () {
        this.roomList = new MusicEngine.Collections.Room();
        this.maxUserRemain = 100;
    },
    run: function () {
        var self = this;
        this.io = io.on( 'connection', function ( socket ) {
            self.onClientConnect( socket );
        } );
    },
    /**
     * When client init, we send to client server infor and room list.
     * But if max user reach, we disconnect
     * @param socket
     */
    onClientInit: function (socket ) {
        var message = new MusicEngine.Models.Message();
        message.set( 'id', uuid.v1() );
        message.set( 'username', 'System' );
        message.set('isAllowed', true);
        if(this.maxUserRemain <= 0){
            message.set('isAllowed', 'false');
            message.set('msg', 'Server is full');
        }
        socket.emit( 'client.init.result', message.toJSON() );
        if ( ! message.get('isAllowed') == true ) {
            socket.disconnect();
        }
    },
    onClientLogin: function ( data, socket ) {
        var isAllowed = true;
        var room = this.roomList.findWhere( {id: data.room} );
        var message = new MusicEngine.Models.Message();
        message.set( 'id', uuid.v1() );
        message.set( 'username', 'System' );
        /**
         * May create room
         */
        if ( room ) {
            /**
             * The room is exist
             */
            message.set( 'msg', 'You joined the room #' + data.room );
        }
        else {
            /**
             * The room is not exist
             */
            message.set( 'msg', 'You Create the room ' + data.room + ', Send this page\'s address to friend and get fun.');
            console.log( socket.id + ' created the room ' + data.room );
            room = new MusicEngine.Models.Room({id: data.room});
            this.roomList.add( room );
            socket.broadcast.to( data.room ).emit( 'room.create', room.toJSON() );
        }
        room.addClient(new MusicEngine.Models.Client({
            id:socket.id,
            name:data.name
        }));
        if ( isAllowed ) {
            /**
             * Decrease max user remain
             */
            this.maxUserRemain--;
            socket.name = data.name;
            socket.room = data.room;
            socket.join( socket.room );

            socket.emit( 'client.login.result', {success: true} );
            io.sockets.to( socket.room ).emit( 'client.connect', _.extend( data, {id: socket.id} ) );
            console.log( socket.id + " : LOGINED name " + socket.name );
            socket.emit( 'message.recive', message.toJSON() );
        }
        else {
            socket.emit( 'client.login.result', {success: false} );
            socket.disconnect();
        }

    },
    onClientDisconnect: function ( socket ) {
        console.log( 'Disconnected :',socket.id );
        var existRoom = this.roomList.findWhere( {id: socket.room} );
        if ( existRoom ) {
            existRoom.removeClient(socket.id);
            console.log( 'There are ' + existRoom.clientCount() + ' member in room ' + socket.room );
            if(existRoom.clientCount() == 0 ){
                this.roomList.remove(existRoom);
                console.log( 'Delete rom ' + socket.room );
            }
        }
        socket.broadcast.to( socket.room ).emit( 'client.leave', {id: socket.id} );
        socket.leave( socket.room );
    },
    /**
     *
     * @param socket
     */
    onClientConnect: function ( socket ) {

        var self = this;
        console.log("CONNECTED :",socket.id );
        self.onClientInit( socket );

        socket.on( 'client.login', function ( data ) {
            self.onClientLogin( data, socket );
        } );

        socket.on( 'disconnect', function () {
            self.onClientDisconnect( socket );
        } );
    }
};
MusicEngineApplication.initialize();
MusicEngineApplication.run();