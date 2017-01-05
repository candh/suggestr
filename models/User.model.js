var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var UserSchema = new Schema({
    _id: {
        type: String,
        unique: true
    },
    suggested: Array,
    movies: Array,
    genre: Array,
    genre_count: Number
}, {
    _id: false
})


module.exports = mongoose.model('User', UserSchema);
