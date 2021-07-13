import express from 'express';
import bodyParser from 'body-parser';

const app = express();
const router = express.Router();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

router.get('/fetch', (req, res) => {
    res.sendStatus(200);
});

app.use('/', router);

module.exports = app;