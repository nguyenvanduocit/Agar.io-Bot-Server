_.templateSettings = {
    evaluate: /\<\#(.+?)\#\>/g,
    interpolate: /\{\{=(.+?)\}\}/g,
    escape: /\{\{-(.+?)\}\}/g
};
var socket = io();
var Application = Backbone.Marionette.Application.extend( {} );
MusicEngine = window.MusicEngine || new Application();
(
    function ( $, Backbone, Marionate, socket, MusicEngine ) {

        MusicEngine.Models = MusicEngine.Models || {};
        MusicEngine.Collections = MusicEngine.Collections || {};
        MusicEngine.Views = MusicEngine.Views || {};
        MusicEngine.Routers = MusicEngine.Routers || {};
        // the pub/sub object for managing event throughout the app
        MusicEngine.pubsub = MusicEngine.pubsub || {};
        MusicEngine.isFirstConnect = true;
        _.extend( MusicEngine.pubsub, Backbone.Events );
    }
)( jQuery, Backbone, Backbone.Marionette, socket, MusicEngine );
/**
 * Module
 */
(
    function ( $, Backbone, Marionate, socket, MusicEngine, Views, Models, Collections ) {
        var requestInfo = window.location.pathname.match( /\/(.*)\/(\d+)$/ );
        if(requestInfo){
            MusicEngine.roomId = Number( requestInfo[ 1 ] );
        }else{
            MusicEngine.roomId = null;
        }
    }
)( jQuery, Backbone, Backbone.Marionette, socket, MusicEngine, MusicEngine.Views, MusicEngine.Models, MusicEngine.Collections );