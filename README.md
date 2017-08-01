# [Suggester](https://candh.github.io/suggestr/) 🤖
A facebook movie 🎬 suggesting bot

[See it in action](https://vimeo.com/197744845)

### Status ✅
Its up and working! Try it...

[m.me/movie.suggester](https://m.me/movie.suggester)

### Where does the movies come from? ☁️
The movies are added in a array, by hand, but not the metadata of them, Just the names! That is imported from a 3rd party API. The API will be credited.

### Contribution 🖥
Add a movie to the array

    vi tools/movie-list.js

Run this script to add the movie to the `movies.json` file found in the db folder

    node tools/movie-list-maker.js

The user data is stored on a mongodb on the cloud.

### Credits
- [OMDB API](https://www.omdbapi.com/) For the movies metadata. Amazing API
- [mlab](https://mlab.com/welcome/) for the database hosting
- [API AI](https://api.ai/) for the AI I wanted. Tried to write my own, but when users grew, uncertainty among their queries also grew. Couldn't handle it. Thanks to them. Amazing work. 
- [Heroku](https://heroku.com) for the app hosting
- [Facebook](https://developers.facebook.com) for their messenger API
- [Flaticon](http://www.flaticon.com/) for the icons on the landing page

### Made by
a stupid piece of shit [@candhforlife](https://twitter.com/candhforlife)
