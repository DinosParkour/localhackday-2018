const express = require("express");
const request = require('request-promise-native');

const app = express();
const port = 3000;

app.set("view engine", "ejs");
app.use(express.static('public'));

app.get("/", (req,res) => {
    res.render("index")
});

app.get("/data", async (req, res) => {
    var response = await request.get('https://opengov.thessaloniki.gr/opengov/api/tour.json')
    res.send(response);
})

app.listen(port, () => console.log('Listening on port localhost:' + port));
