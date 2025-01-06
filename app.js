const express = require("express");
const path = require("path");
const app = express();
const maria = require("mariadb");
const multer = require("multer");

const connectPool = maria.createPool({
    host: "localhost",      // MariaDB 서버 주소 (로컬 서버일 경우 'localhost')
    user: "root",           // 사용자 이름
    password: 'master',     // 비밀번호
    database: 'firstDB',    // 사용할 데이터베이스 이름
    connectionLimit: 5      // 최대 연결 수
});

// 템플릿 엔진을 ejs로 한 것 같음
app.set("view engine", 'ejs');

// ejs가 위치한 폴더
app.set('views', path.join(__dirname, 'public'));

// 정적 파일을 저장하는 폴더
app.use(express.static(path.join(__dirname, 'static')));

var bodyParser = require('body-parser');
const { userInfo } = require("os");
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(bodyParser.text());

app.listen(7777, () => {
    console.log("서버가 3000 포트에서 돌아가고 있습니다");
});

app.get("/", async (req, res) => {
    try {
        const connection = await connectPool.getConnection();
        const students = await connection.query('SELECT * FROM students');
        const files = await connection.query("SELECT * FROM fileuploadtest");

        res.render("index", {
             users : students,
             files : files
        });
        connection.release();
    } catch (err) {
        console.error(err);
        res.status(500).send("서버 오류");
    }
});
app.get("/upload", (req, res) => {
    res.render("upload");
});
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null,'./public') // cb 콜백함수를 통해 전송된 파일 저장 디렉토리 설정
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname) // cb 콜백함수를 통해 전송된 파일 이름 설정
    }
  });

const upload = multer({storage: storage})

app.post('/uploadFile', upload.single('userfile'), async function(req, res){
    try {
        const con = await connectPool.getConnection();
        const n = Date.now().toString();
        await con.query(`
            INSERT INTO fileuploadtest(filename, createAt) 
            VALUES('${req.file.originalname}', '${n}')
        `);
        console.log("성공");
        con.release();
        res.send('Uploaded! : '+ req.file.originalname);
        console.log(req.file);
    } catch (err) {
        console.log(err);
    }
});
app.get("/imgid", async (req, res) => {
    try {
        const con = await connectPool.getConnection();
        const result = await con.query(`
            SELECT id, filename, createAt FROM fileuploadtest WHERE id = ${req.query.id}
        `);
        res.render("particular", { particu : result });
        con.release();
    } catch (err) {
        console.log(err);
    }
});
app.get("/signup", (req, res) => {
    res.render("signup");
});
app.post("signup", async (req, res) => {
    try {
        const con = await connectPool.getConnection();
        const result = await con.query(`
            INSERT INTO users(username, useremail, userpassword, bio, createAt)
            VALUES('${req.query.username}', '${req.query.useremail}', '${req.query.userpassword}', '${req.query.bio}', '${Date.now()}')
        `);
        res.render("index")
    } catch (err) {
        console.log(err);
    }
});
