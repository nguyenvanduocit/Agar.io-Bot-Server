/**
 * Module
 */
(function ($, Backbone, Marionate, AgarBot, app, Views, Models, Collections) {
        window.loadScript("http://127.0.0.1:8181/socket.io/socket.io.js", function () {
            var socket = io.connect("http://127.0.0.1:8181");
            var RoomModule = Marionette.Module.extend({
                initialize: function (options, moduleName, app) {
                    _.extend(this.options, options);
                    this.sendMyBlodInterval = -1;
                },
                initViewEvent: function () {
                    /**
                     * Listen to server connection
                     */
                    this.listenTo(AgarBot.pubsub, 'client.init.result', this.onClientInitResult);
                    this.listenTo(AgarBot.pubsub, 'client.login.result', this.onClientLoginResult);
                    this.listenTo(AgarBot.pubsub, 'room.create', this.onRoomCreate);
                    this.listenTo(AgarBot.pubsub, 'disconnect', this.onDisconnect);
                    /**
                     * Listen to game event
                     */
                    this.listenTo(AgarBot.pubsub, 'Game:connect', this.onGameSocketConnected);
                    this.listenTo(AgarBot.pubsub, 'player:revive', this.startSendMyBlodInfo);
                    //Listen to blod update from another player
                    this.listenTo(AgarBot.pubsub, 'player.updateBlodInfo', this.onOtherPlayerUpdateBlod);
                },
                onOtherPlayerUpdateBlod:function(data){
                    console.log('window.maybePushClanCell(data);');
                    window.maybePushClanCell(data);
                },
                onGameSocketConnected:function(){
                    /**
                     * Logout from current room
                     */
                    if(socket.isLoggedin) {
                        console.log('Server changed, Logout from current room');
                        this.logoutFromServer();
                    }
                    if(window.getMode() ==':party') {
                        socket.emit('client.logout');
                        this.loginToServer();
                    }

                },
                onRoomCreate: function (data) {
                    console.log('Room created');
                    console.log(data);
                },
                onClientInitResult: function (resp) {
                    if (resp.isAllowed) {
                        console.log('Connect is allowed');
                        if(window.getMode() ==':party'){
                            console.log('This is party, Login to server');
                            this.loginToServer();
                        }
                        else{
                            console.log('This is not party, no need to login to server');
                        }
                    } else {
                        console.log('Connect is no allowed')
                    }
                },
                loginToServer:function(){
                    if(!socket.isLoggedin) {
                        console.log('Logining to server');
                        var data = {
                            room: this.generateRoomId(window.getServer(), window.getToken()),
                            name: window.getOriginalName()
                        };
                        socket.isLoggedin = true;
                        socket.emit('client.login', data);
                    }else{
                        console.log('Your are logined')
                    }
                },
                startSendMyBlodInfo:function(){
                    if(this.sendMyBlodInterval == -1){
                        var self = this;
                        this.sendMyBlodInterval = setInterval(function(){self.sendMyBlodInfo()}, 500);
                    }
                },
                stopSendMyBlodInfo:function(){
                    if(this.sendMyBlodInterval != -1){
                        clearInterval(this.sendMyBlodInterval);
                        this.sendMyBlodInterval = -1;
                    }
                },
                sendMyBlodInfo:function(){
                    if(socket.isLoggedin) {
                        var myBlodInfo = [];
                        var player = getPlayer();
                        if (player.length > 0) {
                            for (var k = 0; k < player.length; k++) {
                                var blod = {
                                    id: player[k].id,
                                    size: player[k].size,
                                    x: player[k].x,
                                    y: player[k].y
                                };
                                myBlodInfo.push(blod);
                            }
                            socket.emit('player.sendMyBlodInfo', myBlodInfo);
                        }
                    }
                },
                generateRoomId:function(ip, token){
                    return ip+'#'+token;
                },
                logoutFromServer:function(){
                    if(socket.isLoggedin){
                        console.log('Loging out...');
                        socket.isLoggedin = false;
                        socket.emit('client.logout', {reason:'generel'});
                        this.stopSendMyBlodInfo();
                    }
                    else{
                        console.log("error : Your are not loggedin")
                    }
                },
                onClientLoginResult: function (resp) {
                    console.log("Login result ", resp);
                },
                onDisconnect: function (data) {
                    console.log('You are disconnected');
                },
                updateClient: function () {
                    socket.emit('client.updateClient', data);
                },
                onStart: function (options) {
                    this.initViewEvent();
                },
                onStop: function (options) {
                    this.stopListening();
                }
            });
            /**
             * Register the module with application
             */
            app.module("RoomModule", {
                moduleClass: RoomModule
            });
            /**
             * Run de app
             */
            $(document).ready(function () {
                socket.on('connect', function () {
                    if (AgarBot.isFirstConnect) {
                        AgarBot.isFirstConnect = false;
                        AgarBot.start();
                        AgarBot.pubsub.trigger('connect');
                    } else {
                        AgarBot.pubsub.trigger('reconnect');
                    }
                });
                socket.on('disconnect', function () {
                    AgarBot.pubsub.trigger('disconnect');
                });
                socket.on('client.init.result', function (resp) {
                    AgarBot.pubsub.trigger('client.init.result', resp);
                });
                socket.on('player.updateBlodInfo', function (resp) {
                    AgarBot.pubsub.trigger('player.updateBlodInfo', resp);
                });

                socket.on('client.login.result', function (resp) {
                    AgarBot.pubsub.trigger('client.login.result', resp);
                });
                socket.on('client.leave', function (resp) {
                    AgarBot.pubsub.trigger('client.leave', resp);
                });
                socket.on('room.create', function (resp) {
                    AgarBot.pubsub.trigger('room.create', resp);
                });
            });
        });
    })(jQuery, Backbone, Backbone.Marionette, AgarBot, AgarBot.app, AgarBot.Views, AgarBot.Models, AgarBot.Collections);