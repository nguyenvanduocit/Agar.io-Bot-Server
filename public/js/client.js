/**
 * Module
 */
(function ($, Backbone, Marionate, AgarBot, app, Views, Models, Collections) {
        window.loadScript("http://agarbot.vn:80/socket.io/socket.io.js", function () {
            var socket = io.connect("http://agarbot.vn:80");
            var RoomModule = Marionette.Module.extend({
                initialize: function (options, moduleName, app) {
                    _.extend(this.options, options);
                    this.sendMyBlodInterval = -1;
                    this.stage = 'INIT.WAITING';
                    this.clanLeaderBoard = [];
                    this.roomId = '';
                    this.gameMode = '';
                },
                initViewEvent: function () {
                    /**
                     * Listen to server connection
                     */
                    this.listenTo(AgarBot.pubsub, 'client.init.result', this.onClientInitResult);
                    this.listenTo(AgarBot.pubsub, 'client.login.result', this.onClientLoginResult);
                    this.listenTo(AgarBot.pubsub, 'server:disconnect', this.onDisconnect);
                    this.listenTo(AgarBot.pubsub, 'game:disconnected', this.onGameDisconnected);
                    this.listenTo(AgarBot.pubsub, 'updateLeaderBoard', this.onLeaderBoardUpdated);


                    this.listenTo(AgarBot.pubsub, 'room.create', this.onRoomCreate);
                    this.listenTo(AgarBot.pubsub, 'player:revive', this.startCellsInfo);
                    this.listenTo(AgarBot.pubsub, 'player:dead', this.stopCellsInfo);
                    this.listenTo(AgarBot.pubsub, 'game:updateMassterInfo', this.onSetToMaster);
                    //Listen to blod update from another player
                    this.listenTo(AgarBot.pubsub, 'player.updateBlodInfo', this.onOtherPlayerUpdateBlod);
                    this.listenTo(AgarBot.pubsub, 'command.recived', this.onCommandRecived);
                    this.listenTo(AgarBot.pubsub, 'sendCommand', this.onSendCommand);

                },
                onGameDisconnected:function(){
                    this.logoutFromServer();
                },
                onLeaderBoardUpdated:function(){
                    var leaderBoard = window.getLeaderBoard();
                    var li = '';
                    for(var i = 0; i < leaderBoard.length; i++){
                        li+='<li>'+(leaderBoard[i].name||'Unname') +'</li>';
                    }
                    $('.agario-shop-panel').html('<ol>'+li+'</ol>');
                    if(this.stage == 'INIT.SUCCESS' || this.stage == 'LOGOUT.SUCCESS' || this.stage == 'LOGIN.ROOM_FOUND')
                    {
                        console.log('Login');
                        this.loginToServer();
                    }else if(this.stage == "LOGIN.SUCCESS"){
                        socket.emit('player.updateLeaderBoard',leaderBoard);
                    }else if(this.stage == 'LOGIN.FIND_ROOM'){
                        var found = this.compareLeaderBoard(leaderBoard, this.clanLeaderBoard);
                        if(!found){
                            console.log('This server is not match with room leader board.');
                            setTimeout(window.findServer, 10000);
                            window.disconnect();
                        }else{
                            console.log('this room is matched');
                            this.stage = 'LOGIN.ROOM_FOUND';
                        }
                    }
                },
                /**
                 * TODO move to controlpanel
                 */
                onSendCommand:function(data){
                    if(this.stage == 'LOGIN.SUCCESS') {
                        socket.emit('sendCommand', data);
                    }
                },
                compareLeaderBoard:function(boardA, boardB){
                    for(var i = 0; i < boardA.length; i++){
                        for(var j = 0; j < boardB.length; j++){
                            if(boardA[i].name == boardB[j].name){
                                return true;
                            }
                        }
                    }
                    return false;
                },
                onCommandRecived:function(data){
                    if(data.command == 'invite'){
                        this.onInviteRecived(data.args);
                    }else if(data.command == 'changeBotSetting'){
                        AgarBot.pubsub.trigger('command.changeBotSetting', data.args);
                    }
                },
                onInviteRecived:function(data){
                    console.log('Recive invited');
                    if(window.isFeeder() && this.stage == 'LOGIN.SUCCESS'){
                        var leaderBoardMatched = false;
                        var roomId = this.generateRoomId(data.ip, data.region, data.key);
                        if(this.clanLeaderBoard.length > 0){
                            leaderBoardMatched = this.compareLeaderBoard(data.leaderBoard, this.clanLeaderBoard);
                        }
                        if(!leaderBoardMatched){
                            //TODO implement on party mode
                            if(data.mode == ':party' || data.mode == ''){
                                if(data.mode == ':party') {
                                    this.roomId = roomId;
                                    /**
                                     * Just connect
                                     */
                                    setGameModeSilent(':party');
                                    setRegionSilent(data.region);
                                    connect(data.ip, data.key);
                                }
                                this.stage = 'LOGIN.FIND_ROOM';
                                this.clanLeaderBoard = data.leaderBoard;
                            }else{
                                console.log('This mode is not accept')
                            }
                        }else{
                            if(this.roomId == roomId){
                                console.log('You are in this room, no need to join.');
                            }else{
                                console.log('Leader board match but in diferrence room.');
                                this.logoutFromServer();
                                this.roomId = roomId;
                                this.loginToServer();
                            }
                        }
                    }
                },
                onSetToMaster:function(data){
                    if(this.stage == 'LOGIN.SUCCESS') {
                        socket.emit('player:masterInfo', data);
                    }
                },
                /**
                 * When recive other player's blod info
                 * @param data
                 */
                onOtherPlayerUpdateBlod:function(data){
                    if(this.stage == 'LOGIN.SUCCESS') {
                        try {
                            window.maybePushClanCell(data);
                        } catch (e) {
                            console.log(e);
                        }
                    }
                },
                /**
                 * When some room clreated
                 * @param data
                 */
                onRoomCreate: function (data) {
                    console.log('Room created');
                    console.log(data);
                },
                /**
                 * When init request responsed
                 * @param resp
                 */
                onClientInitResult: function (resp) {
                    if (resp.isAllowed) {
                        this.stage = 'INIT.SUCCESS';
                    } else {
                        this.stage = 'INIT.FAIL';
                    }
                    console.log(this.stage);
                },
                /**
                 * Lieave room
                 */
                loginToServer:function(){
                    if(this.stage =='INIT.SUCCESS' || this.stage == 'LOGIN.ROOM_FOUND' || this.stage == 'LOGOUT.SUCCESS') {
                        console.log('Logining to server');
                        if(this.roomId == ''){
                            this.roomId = this.generateRoomId(window.getServer(), window.getRegion(), window.getToken());
                        }
                        var data = {
                            room: this.roomId,
                            name: $('#nick').val(),
                            leaderBoard : window.getLeaderBoard()
                        };
                        this.stage = "LOGIN.WAITING";
                        socket.emit('client.login', data);
                    }else{
                        console.log('Your are logined')
                    }
                },
                /**
                 * Send my blod
                 */
                startCellsInfo:function(){
                    if(this.sendMyBlodInterval == -1 && this.stage == 'LOGIN.SUCCESS'){
                        var self = this;
                        this.sendMyBlodInterval = setInterval(function(){self.sendCellInfo()}, 100);
                    }
                },
                /**
                 * Stop send my blod info
                 */
                stopCellsInfo:function(){
                    if(this.sendMyBlodInterval != -1){
                        clearInterval(this.sendMyBlodInterval);
                        this.sendMyBlodInterval = -1;
                    }
                },
                /**
                 * Send my blod info
                 */
                sendCellInfo:function(){
                    if(this.stage == 'LOGIN.SUCCESS') {
                        /**
                         * CurrentBlod info
                         * @type {Array}
                         */
                        var allCells = getCells();
                        var cellInfo = [];
                        Object.keys(allCells).forEach(function(k, index) {
                            if(!allCells[k].isVirus() && (allCells[k].size > 50)) {
                                var cell = {
                                    id: allCells[k].id,
                                    size: allCells[k].size,
                                    name :allCells[k].name,
                                    x: allCells[k].x,
                                    y: allCells[k].y,
                                    color: allCells[k].color
                                };
                                cellInfo.push(cell);
                            }
                        });
                        socket.emit('player.sendMyBlodInfo', cellInfo);
                    }
                },
                /**
                 * Generate room id
                 * @param ip
                 * @param token
                 * @returns {string}
                 */
                generateRoomId:function(ip, region, token){
                    return ip + '#' + region +'#'+token;
                },
                logoutFromServer:function(){
                    if(this.stage == 'LOGIN.SUCCESS'){
                        console.log('Loging out...');
                        socket.emit('client.logout', {reason:'generel'});
                        if(this.stage != 'LOGIN.FIND_ROOM'){
                            this.stage = 'LOGOUT.SUCCESS';
                            this.roomId = '';
                        }
                        this.stopCellsInfo();
                    }
                    else{
                        console.log("error : Your are not loggedin")
                    }
                },
                onClientLoginResult: function (resp) {
                    if(resp.success){
                        this.stage = "LOGIN.SUCCESS";
                        AgarBot.pubsub.trigger('client.login.success', resp);
                    }else{
                        if(resp.reason == 'LEADERBOARD.NOT_MATCH')
                        {
                            this.stage = "LOGIN.FIND_ROOM";
                            this.clanLeaderBoard = resp.room.leaderBoard;
                            console.log('Login fail because leader board not match');
                        }
                        else{
                            this.stage = "LOGIN.FAIL";
                            console.log('Server is full');
                            AgarBot.pubsub.trigger('client.login.fail');
                        }
                    }
                    console.log(this.stage);
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
                    AgarBot.pubsub.trigger('server:disconnect');
                });
                socket.on('client.init.result', function (resp) {
                    AgarBot.pubsub.trigger('client.init.result', resp);
                });
                socket.on('player.updateBlodInfo', function (resp) {
                    AgarBot.pubsub.trigger('player.updateBlodInfo', resp);
                });
                socket.on('player:masterInfo', function (resp) {
                    AgarBot.pubsub.trigger('server:masterInfo', resp);
                    //Listen on js/FeedBot/FeedBot.js:66
                });
                socket.on('command.recived', function (resp) {
                    AgarBot.pubsub.trigger('command.recived', resp);
                    //Listen on js/FeedBot/FeedBot.js:66
                });

                socket.on('client.login.result', function (resp) {
                    AgarBot.pubsub.trigger('client.login.result', resp);
                });
                socket.on('client.leave', function (resp) {
                    AgarBot.pubsub.trigger('client.leave', resp);
                });
                socket.on('client.connect', function (resp) {
                    AgarBot.pubsub.trigger('client.connect', resp);
                });
                socket.on('room.create', function (resp) {
                    AgarBot.pubsub.trigger('room.create', resp);
                });
            });
        });
    })(jQuery, Backbone, Backbone.Marionette, AgarBot, AgarBot.app, AgarBot.Views, AgarBot.Models, AgarBot.Collections);