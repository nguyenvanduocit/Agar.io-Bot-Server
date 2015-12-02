var colors = require('colors/safe');
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
        'clients':new MusicEngine.Collections.Client(),
        'leaderBoard':[]
    },
    findWhereClient:function(attributes){
        var clients = this.get('clients');
        return clients.findWhere(attributes);
    },
    addClient:function(client) {
        var clients = this.get('clients');
        clients.add(client);
    },
    removeClient:function(client){
        var clients = this.get('clients');
        clients.remove(client);
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
            console.log('Init denei');
        }
    },
    /**
     * When client want to join or create room.
     * @param data
     * @param socket
     */
    onClientLogin: function ( data, socket ) {
        var isAllowed = false;
        var reason = '';
        var room = this.roomList.findWhere( {id: data.room} );
        var message = new MusicEngine.Models.Message();
        message.set( 'id', uuid.v1() );
        message.set( 'username', 'System' );
        /**
         * May create room
         */
        if ( room ) {
            var roomLeaderBoard = room.get('leaderBoard');
            if(roomLeaderBoard){
                /**
                 * The room is exist
                 */
                message.set( 'msg', 'You joined the room #' + data.room );
                console.log(colors.green('JOIN : '),socket.id + ' joined the room #' + data.room);
                for(var i = 0; i < roomLeaderBoard.length; i++){
                    var found = false;
                    for(var j = 0; j < data.leaderBoard.length; j++){
                        if(data.leaderBoard[j].id == roomLeaderBoard[i].id){
                            isAllowed = true;
                            found = true;
                            break;
                        }
                    }
                    if(found){
                        break;
                    }else{
                        reason = 'Leader board is not match';
                    }
                }
            }
        }
        else {
            /**
             * The room is not exist
             */
            message.set( 'msg', 'You Create the room ' + data.room + ', Send this page\'s address to friend and get fun.');
            console.log( colors.green("Create room : "),socket.id + ' created the room ' + data.room );
            room = new MusicEngine.Models.Room(
                {
                    id: data.room,
                    clients:new MusicEngine.Collections.Client()
                }
            );
            this.roomList.add( room );
            isAllowed = true;
        }
        if ( isAllowed ) {
            room.set('leaderBoard', data.leaderBoard);
            room.addClient(new MusicEngine.Models.Client({
                id:socket.id,
                name:data.name
            }));

            /**
             * Decrease max user remain
             */
            this.maxUserRemain--;
            socket.name = data.name;
            socket.room = data.room;
            socket.join( socket.room );

            socket.broadcast.to( data.room ).emit( 'room.create', room.toJSON() );
            socket.emit( 'client.login.result', {success: true} );
            io.sockets.to( socket.room ).emit( 'client.connect', _.extend( data, {id: socket.id} ) );
            console.log( socket.id + " : LOGINED name " + socket.name );
            console.log('There are ' + room.clientCount() + ' member in room ' + socket.room);
            socket.emit( 'message.recive', message.toJSON() );
        }
        else {
            socket.emit( 'client.login.result', {success: false} );
            console.log('Login denie');
        }

    },
    /**
     * When client want to logout from rooom
     * @param data
     * @param socket
     */
    onClientLogout:function(data,socket){
        console.log( 'Logout :',socket.id );
        this.removeSocketFromRoom(socket);
    },
    /**
     * When client disconnect
     * @param socket
     */
    onClientDisconnect: function ( socket ) {
        console.log(colors.red("DISCONNECTED : "),socket.id);
        this.removeSocketFromRoom(socket);
    },
    /**
     * Remove current client from all room
     * @param socket
     */
    removeSocketFromRoom:function(socket){
        if(typeof socket.room !='undefined') {
            var existRoom = this.roomList.findWhere({id: socket.room});
            if (existRoom) {
                existRoom.removeClient(socket.id);
                console.log('There are ' + existRoom.clientCount() + ' member in room ' + socket.room);
                if (existRoom.clientCount() == 0) {
                    this.roomList.remove(existRoom);
                    console.log(colors.red('Delete rom '),socket.room);
                }
            }
            socket.broadcast.to(socket.room).emit('client.leave', {id: socket.id});
            socket.leave(socket.room);
        }
    },
    onReciveLeaderBoard:function(data, socket){
        var room = this.roomList.findWhere( {id: data.room} );
        if(room){
            room.set('leaderBoard', data);
        }
    },
    onRecivePlayerBlodInfo:function(data,socket){
        socket.broadcast.to(socket.room).emit('player.updateBlodInfo', data);
    },
    onReciveMasterInfo:function(data, socket){
        socket.broadcast.to(socket.room).emit('player:masterInfo', data);
    },
    onReciveCommand:function(data, socket){
        var commandArgs = {};
        var eventName = false;
        switch(data.command){
            case 'invite':
                eventName = 'command.invite';
                commandArgs = {
                    ip:data.args.ip,
                    key:data.args.key,
                    mode:data.args.mode,
                    leaderBoard:data.args.leaderBoard
                };
                break;
        }
        if(eventName != false){
            /**
             * Emit to all client, bot logined or not
             */
            socket.broadcast.emit(eventName, commandArgs);
        }
    },
    /**
     *
     * @param socket
     */
    onClientConnect: function ( socket ) {

        var self = this;
        console.log(colors.green("CONNECTED : "),socket.id);
        self.onClientInit( socket );

        socket.on( 'client.login', function ( data ) {
            self.onClientLogin( data, socket );
        } );
        /**
         * Client may logout without disconnect, that happen when the change server
         */
        socket.on( 'client.logout', function (data) {
            self.onClientLogout(data, socket );
        } );

        socket.on( 'player.sendMyBlodInfo', function (data) {
            self.onRecivePlayerBlodInfo(data, socket );
        } );
        socket.on( 'player.updateLeaderBoard', function (data) {
            self.onReciveLeaderBoard(data, socket );
        } );
        socket.on( 'player:masterInfo', function (data) {
            self.onReciveMasterInfo(data, socket );
        } );

        socket.on( 'sendCommand', function (data) {
            self.onReciveCommand(data, socket );
        } );

        socket.on( 'disconnect', function () {
            self.onClientDisconnect( socket );
        } );
    }
};
MusicEngineApplication.initialize();
MusicEngineApplication.run();