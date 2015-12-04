module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: '<json:package.json>',
    uglify: {
      my_target: {
        files: {
          'public/js/bot.min.js': [
              'public/lib/underscore-min.js',
            'public/js/client.js',
            'public/lib/backbone-min.js',
            'public/lib/backbone.marionette.js'
          ]
        }
      }
    }
  });
  grunt.loadNpmTasks('grunt-contrib-uglify');
  // Default task.
  grunt.registerTask('default', ['uglify']);

};