module.exports = function(grunt) {
   grunt.initConfig({
    execute: {
        simple_target: {
            // execute javascript files in a node child_process
            src: ['test_helper.js']
        }

    }
})


grunt.loadNpmTasks('grunt-execute');
grunt.registerTask('default', ['execute']);

}

  // Require needed grunt-modules



  // Define tasks
  //grunt.registerTask('default', ['uglify']);