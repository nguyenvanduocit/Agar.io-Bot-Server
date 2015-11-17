/**
 * Module
 */
(
    function ( $, Backbone, Marionate, socket, MusicEngine, Views, Models, Collections ) {
        var RoomModule = Marionette.Module.extend( {
            initialize: function ( options, moduleName, app ) {
                _.extend( this.options, options );

            },
            initViewEvent: function () {
                this.listenTo( MusicEngine.pubsub, 'client.init.result', this.onClientInitResult );
                this.listenTo( MusicEngine.pubsub, 'client.login.result', this.onClientLoginResult );
                this.listenTo( MusicEngine.pubsub, 'room.create', this.onRoomCreate );
                this.listenTo( MusicEngine.pubsub, 'disconnect', this.onDisconnect );
            },
            onRoomCreate:function(data){
                console.log('Room created');
                console.log(data);
            },
            onClientInitResult:function(resp){
                if(resp.isAllowed){
                    console.log('Connect is allowed');
                    socket.emit('client.login', {room:'192.167.1.1#DKXK', name:'Được'})
                }else{
                    console.log('Connect is no allowed')
                }
            },
            onClientLoginResult:function(resp){
                console.log(resp);
            },
            onDisconnect: function ( data ) {
                console.log( 'You are disconnected' );
            },
            updateClient:function(){
                socket.emit('client.updateClient', data);
            },
            onStart: function ( options ) {
                this.initViewEvent();
            },
            onStop: function ( options ) {
                this.stopListening();
            }
        } );
        /**
         * Register the module with application
         */
        MusicEngine.module("RoomModule", {
            moduleClass: RoomModule
        });
        /**
         * Run de app
         */
        $( document ).ready( function () {
            MusicEngine.on( 'start', function () {
                Backbone.history.start();
                socket.on( 'client.init.result', function ( resp ) {
                    MusicEngine.pubsub.trigger( 'client.init.result', resp );
                } );

                socket.on( 'client.login.result', function ( resp ) {
                    MusicEngine.pubsub.trigger( 'client.login.result', resp );
                } );
                socket.on( 'client.leave', function ( resp ) {
                    MusicEngine.pubsub.trigger( 'client.leave', resp );
                } );
                socket.on( 'room.create', function ( resp ) {
                    MusicEngine.pubsub.trigger( 'room.create', resp );
                } );
            } );

            socket.on( 'connect', function () {
                if (MusicEngine.isFirstConnect ) {
                    MusicEngine.isFirstConnect = false;
                    MusicEngine.start();
                    MusicEngine.pubsub.trigger( 'connect' );
                }else{
                    MusicEngine.pubsub.trigger( 'reconnect' );
                }
            } );
            socket.on( 'disconnect', function () {
                MusicEngine.pubsub.trigger( 'disconnect' );
            } );
        } );
    }
)( jQuery, Backbone, Backbone.Marionette, socket, MusicEngine, MusicEngine.Views, MusicEngine.Models, MusicEngine.Collections );