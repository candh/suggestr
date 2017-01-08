var colors = require('colors');
var fs = require('fs');

var movie_list = 'db/movies.json';

fs.readFile(movie_list, 'utf8', function(err, data) {
    if (err) {
        console.log(err);
    }
    var time = 0;
    data = JSON.parse(data);
    console.log(colors.green(`total movies -> ${data.length}`));
    data.forEach(function(e, i, arr) {
        time += (parseInt(e.Runtime));
    });
    console.log(`Total Movie Minutes -> ${time}`.yellow);
    console.log(`Total Movie Hours -> ${time / 60}`.green)
    
});
