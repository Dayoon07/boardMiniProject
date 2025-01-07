const express = require("express");
const path = require("path");
const app = express();
const maria = require("mariadb");
const multer = require("multer");
var bodyParser = require('body-parser');
const session = require("express-session");

const connectPool = maria.createPool({
    host: "localhost",          // MariaDB 서버 주소 (로컬 서버일 경우 'localhost')
    user: "root",               // 사용자 이름
    password: 'master',         // 비밀번호
    database: 'firstdb',        // 사용할 데이터베이스 이름
    connectionLimit: 5          // 최대 연결 수
});

app.use(session({
    secret: 'sk',               // 세션 암호화에 사용될 비밀 키
    resave: false,              // 세션을 항상 저장할지 여부
    saveUninitialized: true,    // 초기화되지 않은 세션을 저장할지 여부
    cookie: { secure: false }   // true로 설정하면 HTTPS에서만 작동 (개발 환경에서는 false)
}));

// 템플릿 엔진을 ejs로 한 것 같음
app.set("view engine", 'ejs');

// ejs가 위치한 폴더
app.set('views', path.join(__dirname, 'public'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(bodyParser.text());

app.listen(7777, () => {
    console.log("서버가 7777 포트에서 돌아가고 있습니다");
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public', 'images'));  // 이미지 저장 폴더
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));  // 파일 이름 설정
    }
});
const upload = multer({ storage: storage });
/*
    CREATE TABLE users(
        id int(11) primary key auto_increment,
        username varchar(50) not null,
        useremail varchar(100) not null,
        password varchar(50) not null,
        bio text,
        datetime varchar(50) not null
    );
    CREATE TABLE board(
        id int(11) primary key auto_increment,
        writer varchar(50) not null,
        title varchar(100) not null,
        content text not null,
        imgname varchar(100) not null,
        datetime varchar(50) not null
    );
*/
app.get("/", async (req, res) => {
    let con;
    try {
        con = await connectPool.getConnection();
        const boards = await con.query(`SELECT * FROM board`);

        // session 객체를 전달
        res.render("index", { boards, session: req.session });
    } catch (error) {
        console.error("DB 에러남 : ", error);
        res.send("Error loading the page.");
    } finally {
        if (con) con.release();
    }
});

app.get('/show', async function(req, res) {
    let con;
    try {
        con = await connectPool.getConnection();
        const r1 = await con.query(`SELECT * FROM board ORDER BY id DESC`);
        res.render('show', { ls : r1 });
    } catch (err) {
        res.status(500).send("DB 에러남 : " + err);
    }
});

app.get("/signup", (req, res) => {
    res.render("signup");
});

app.post("/signup", async (req, res) => {
    let con;
    const { username, useremail, password } = req.body;
    
    try {
        con = await connectPool.getConnection();
        const existingUser = await con.query("SELECT * FROM users WHERE useremail = ?", [useremail]);
        if (existingUser.length > 0) {
            res.send("이미 같은 이메일이 있습니다");
            return;
        }
        const n = new Date;
        const nowStr = n.getFullYear() + "년 " + (n.getMonth() + 1) + "월 " + n.getDate() + "일 " + 
            n.getHours() + "시 " + n.getMinutes() + "분 " + n.getSeconds() + "초";
        await con.query(`INSERT INTO users (username, useremail, password, datetime) VALUES ('${username}', '${useremail}', '${password}', '${nowStr}')`);
        res.redirect("/login");
    } catch (error) {
        console.error("DB 에러남 : ", error);
        res.send("회원가입 실패");
    } finally {
        if (con) con.release();
    }
});

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    } else {
        res.redirect("/login");
    }
}

app.get("/dashboard", isAuthenticated, (req, res) => {
    res.render("dashboard", { user: req.session.user });
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", async (req, res) => {
    let con;
    const { username, password } = req.body;
    try {
        con = await connectPool.getConnection();
        const user = await con.query("SELECT * FROM users WHERE username = ? AND password = ?", [username, password]);
        if (user.length > 0) {
            req.session.user = user[0];
            res.redirect("/dashboard");
        } else {
            res.send("저장된 회원 정보가 없습니다");
        }
    } catch (error) {
        console.error("DB 에러남 : ", error);
        res.send("에러남");
    } finally {
        if (con) con.release();
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.send("에러남");
        }
        res.redirect("/");
    });
});

app.get("/board/create", (req, res) => {
    res.render("create");
});
  
app.post("/board/create", upload.single('filename'), async function(req, res) {
    let con;
    const { writer, title, content } = req.body;

    try {
        con = await connectPool.getConnection();
        const imageUrl = `/images/${req.file.filename}`;
        const n = new Date();
        const nowStr = n.getFullYear() + "년 " + (n.getMonth() + 1) + "월 " + n.getDate() + "일 " + 
        n.getHours() + "시 " + n.getMinutes() + "분 " + n.getSeconds() + "초";
        
        await con.query(
        `INSERT INTO board (writer, title, content, imgname, datetime) VALUES (?, ?, ?, ?, ?)`, 
        [writer, title, content, imageUrl, nowStr]
        );
        
        res.redirect("/");
    } catch (error) {
        console.error("DB 에러 발생: ", error);
        res.status(500).send("게시글을 만드는 도중 에러가 발생했습니다.");
    } finally {
        if (con) con.release();
    }
});

app.get("/board/:id", async (req, res) => {
    let con;
    try {
        const d = req.params.id;
        con = await connectPool.getConnection();
        const board = await con.query(`SELECT * FROM board WHERE id = '${d}'`);
        if (board.length > 0) {
            res.render("board", { board: board[0] });
        } else {
            res.send("존재하지 않는 글입니다");
        }
    } catch (error) {
        console.error("DB 에러남 : ", error);
        res.send("글을 로드하는 도중 에러남");
    } finally {
        if (con) con.release();
    }
});

app.get("/board/edit/:id", async (req, res) => {
    let con;
    try {
        con = await connectPool.getConnection();
        const board = await con.query(`SELECT * FROM board WHERE id = '${req.params.id}'`);
        if (board.length > 0) {
            res.render("edit", { board: board[0] });
        } else {
            res.send("존재하지 않는 글입니다");
        }
    } catch (error) {
        console.error("DB 에러남 : ", error);
        res.send("글을 수정하는 페이지를 로드하는 도중 에러남");
    } finally {
        if (con) con.release();
    }
});

app.post("/board/edit/:id", async (req, res) => {
    let con;
    const boardId = req.params.id;
    const { title, content } = req.body;
    try {
        con = await connectPool.getConnection();
        await con.query("UPDATE board SET title = ?, content = ? WHERE id = ?", [title, content, boardId]);
        res.redirect("/board/" + boardId);
    } catch (error) {
        console.error("DB 에러남 : ", error);
        res.send("수정하는 도중 에러남");
    } finally {
        if (con) con.release();
    }
});

app.post("/board/delete/:id", async (req, res) => {
    let con;
    try {
        con = await connectPool.getConnection();
        await con.query(`DELETE FROM board WHERE id = '${req.params.id}'`);
        res.redirect("/");
    } catch (error) {
        console.error("DB 에러남 : ", error);
        res.send("삭제하는 도중 에러남");
    } finally {
        if (con) con.release();
    }
});

app.post("/showDeleteButOneRecord/del/:id", async (req, res) => {
    let con;
    try {
        con = await connectPool.getConnection();
        await con.query(`DELETE FROM board WHERE id = '${req.params.id}'`);
        res.redirect("/show");
    } catch (error) {
        console.error("DB 에러남 : ", error);
        res.send("삭제하는 도중 에러남");
    } finally {
        if (con) con.release();
    }
});
