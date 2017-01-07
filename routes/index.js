var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
    res.send('working good');
});

// exporting the router
module.exports = router;
