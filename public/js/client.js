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
                },
                initViewEvent: function () {
                    /**
                     * Listen to server connection
                     */
                    this.listenTo(AgarBot.pubsub, 'client.init.result', this.onClientInitResult);
                    this.listenTo(AgarBot.pubsub, 'client.login.result', this.onClientLoginResult);
                    this.listenTo(AgarBot.pubsub, 'client.login.success', this.onClientLoginSuccess);
                    this.listenTo(AgarBot.pubsub, 'disconnect', this.onDisconnect);
                    this.listenTo(AgarBot.pubsub, 'updateLeaderBoard', this.onLeaderBoardUpdated);
                },
                initEventAfterLoginSuccess:function(){
                    this.listenTo(AgarBot.pubsub, 'room.create', this.onRoomCreate);
                    this.listenTo(AgarBot.pubsub, 'player:revive', this.startCellsInfo);
                    this.listenTo(AgarBot.pubsub, 'game:updateMassterInfo', this.onSetToMaster);
                    //Listen to blod update from another player
                    this.listenTo(AgarBot.pubsub, 'player.updateBlodInfo', this.onOtherPlayerUpdateBlod);
                    this.listenTo(AgarBot.pubsub, 'command.invite', this.onInviteRecived);
                    this.listenTo(AgarBot.pubsub, 'sendCommand', this.onSendCommand);
                },
                onLeaderBoardUpdated:function(){
                    var leaderBoard = window.getLeaderBoard();
                    var li = '';
                    for(var i = 0; i < leaderBoard.length; i++){
                        li+='<li>'+(leaderBoard[i].name||'Uname') + '-' + leaderBoard[i].id +'</li>';
                    }
                    var serverInfo = getServer() + "#" + getToken();
                    $('.agario-shop-panel').html('<ol>'+li+'</ol>');
                    if(this.stage == 'INIT.SUCCESS')
                    {
                        console.log('Login');
                        this.loginToServer();
                    }else if(this.stage == "LOGIN.SUCCESS"){
                        socket.emit('player.updateLeaderBoard',leaderBoard);
                    }else if(this.stage == 'LOGIN.FIND_ROOM'){
                        var found = false;
                        for(var i = 0; i < leaderBoard.length; i++){
                            for(var j = 0; j < this.clanLeaderBoard.length; j++){
                                if(leaderBoard[i].id == this.clanLeaderBoard[j].id){
                                    found = true;
                                    break;
                                }
                            }
                            if(found){
                                break;
                            }
                        }
                        if(!found){
                            console.log(leaderBoard);
                            console.log('This server is not match with room leader board.');
                            setTimeout(window.findServer, 10000);
                        }else{
                            this.stage = 'INIT.WAITING';
                        }
                    }
                },
                /**
                 * TODO move to controlpanel
                 */
                onSendCommand:function(data){
                    socket.emit('sendCommand',data);
                },
                onInviteRecived:function(data){
                    if(window.isFeeder()){
                        //TODO implement on party mode
                        if(window.getMode() == ':party'){
                            /**
                             * Just connect
                             */
                            $("#helloContainer").attr("data-gamemode", ':party');
                            $("#gamemode").val(":party");
                            $(".partyToken").val("agar.io/#" + encodeURIComponent(data.key));
                            $("#helloContainer").attr("data-party-state", "5");
                            var a = decodeURIComponent(data.key).replace(/.*#/gim, "");
                            window.history && window.history.replaceState && window.history.replaceState({}, window.document.title, "#"+encodeURIComponent(a));
                            setGameMode(":party");
                            connect(data.ip, data.key);
                            setNick('DuocNV');
                        }
                        else if(window.getMode() == ''){
                            console.log(data);
                            this.stage = 'LOGIN.FIND_ROOM';
                            this.clanLeaderBoard = data.leaderBoard;
                        }
                    }else{
                        console.log('Recive invite');
                    }
                },
                onSetToMaster:function(data){
                    socket.emit('player:masterInfo',data);
                },
                /**
                 * When recive other player's blod info
                 * @param data
                 */
                onOtherPlayerUpdateBlod:function(data){
                    try {
                        window.maybePushClanCell(data);
                    }catch(e){
                        console.log(e);
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
                    if(this.stage =='INIT.SUCCESS') {
                        console.log('Logining to server');
                        var data = {
                            room: this.generateRoomId(window.getServer(), window.getToken()),
                            name: window.getOriginalName(),
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
                    if(this.sendMyBlodInterval == -1){
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
                    if(socket.isLoggedin) {
                        /**
                         * CurrentBlod info
                         * @type {Array}
                         */
                        var allCells = getCells();
                        var cellInfo = [];
                        Object.keys(allCells).forEach(function(k, index) {
                            if(!allCells[k].isVirus() && (allCells[k].size > 13)) {
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
                generateRoomId:function(ip, token){
                    return ip+'#'+token;
                },
                logoutFromServer:function(){
                    if(socket.isLoggedin){
                        console.log('Loging out...');
                        socket.isLoggedin = false;
                        socket.emit('client.logout', {reason:'generel'});
                        this.stopCellsInfo();
                    }
                    else{
                        console.log("error : Your are not loggedin")
                    }
                },
                onClientLoginSuccess:function(){
                    this.initEventAfterLoginSuccess();
                },
                onClientLoginResult: function (resp) {
                    if(resp.success){
                        this.stage = "LOGIN.SUCCESS";
                        AgarBot.pubsub.trigger('client.login.success');
                    }else{
                        this.stage = "LOGIN.FAIL";
                        AgarBot.pubsub.trigger('client.login.fail');
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
                    AgarBot.pubsub.trigger('disconnect');
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
                socket.on('command.invite', function (resp) {
                    AgarBot.pubsub.trigger('command.invite', resp);
                    //Listen on js/FeedBot/FeedBot.js:66
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