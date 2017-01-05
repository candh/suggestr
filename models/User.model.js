var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var UserSchema = new Schema({
    _id: {
        type: String,
        unique: true
    },
    suggested: Array,
    movies: Array,
    genre: Array
}, {
    _id: false
})


module.exports = mongoose.model('User', UserSchema);
