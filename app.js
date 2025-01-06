const express = require("express");
const path = require("path");
const app = express();
const maria = require("mariadb");
const multer = require("multer");
var bodyParser = require('body-parser');
const session = require("express-session");

const connectPool = maria.createPool({
    host: "localhost",      // MariaDB 서버 주소 (로컬 서버일 경우 'localhost')
    user: "root",           // 사용자 이름
    password: '1111',       // 비밀번호
    database: 'mydb',       // 사용할 데이터베이스 이름
    connectionLimit: 5      // 최대 연결 수
});

app.use(session({
    secret: 'your-secret-key', // 세션 암호화에 사용될 비밀 키
    resave: false,             // 세션을 항상 저장할지 여부
    saveUninitialized: true,   // 초기화되지 않은 세션을 저장할지 여부
    cookie: { secure: false }  // true로 설정하면 HTTPS에서만 작동 (개발 환경에서는 false)
}));

// 템플릿 엔진을 ejs로 한 것 같음
app.set("view engine", 'ejs');

// ejs가 위치한 폴더
app.set('views', path.join(__dirname, 'public'));

// 정적 파일을 저장하는 폴더
app.use(express.static(path.join(__dirname, 'static')));

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(bodyParser.text());

app.listen(7777, () => {
    console.log("서버가 7777 포트에서 돌아가고 있습니다");
});
/*
users
+-----------+--------------+------+-----+---------+----------------+
| Field     | Type         | Null | Key | Default | Extra          |
+-----------+--------------+------+-----+---------+----------------+
| id        | int(11)      | NO   | PRI | NULL    | auto_increment |
| username  | varchar(50)  | NO   |     | NULL    |                |
| useremail | varchar(100) | NO   |     | NULL    |                |
| password  | varchar(50)  | NO   |     | NULL    |                |
| bio       | text         | YES  |     | NULL    |                |
+-----------+--------------+------+-----+---------+----------------+

board
+---------+--------------+------+-----+---------+----------------+
| Field   | Type         | Null | Key | Default | Extra          |
+---------+--------------+------+-----+---------+----------------+
| id      | int(11)      | NO   | PRI | NULL    | auto_increment |
| writer  | varchar(50)  | NO   |     | NULL    |                |
| title   | varchar(100) | NO   |     | NULL    |                |
| content | text         | NO   |     | NULL    |                |
| views   | int(11)      | NO   |     | 0       |                |
+---------+--------------+------+-----+---------+----------------+

comment
+-----------------+-------------+------+-----+---------+----------------+
| Field           | Type        | Null | Key | Default | Extra          |
+-----------------+-------------+------+-----+---------+----------------+
| id              | int(11)     | NO   | PRI | NULL    | auto_increment |
| board_id        | int(11)     | NO   |     | NULL    |                |
| comment_id      | int(11)     | NO   |     | NULL    |                |
| comment_name    | varchar(50) | NO   |     | NULL    |                |
| comment_content | text        | NO   |     | NULL    |                |
+-----------------+-------------+------+-----+---------+----------------+
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

app.get("/signup", (req, res) => {
    res.render("signup"); // signup.ejs 템플릿 렌더링
});

app.post("/signup", async (req, res) => {
    let con;
    const { username, useremail, password } = req.body;
    
    try {
        // 데이터베이스 연결
        con = await connectPool.getConnection();

        // 같은 이메일이 이미 존재하는지 확인
        const existingUser = await con.query("SELECT * FROM users WHERE useremail = ?", [useremail]);

        if (existingUser.length > 0) {
            res.send("Email already in use."); // 이메일이 이미 존재하는 경우
            return;
        }

        // 사용자 정보 INSERT
        await con.query("INSERT INTO users (username, useremail, password) VALUES (?, ?, ?)", [username, useremail, password]);

        // 회원가입 후 로그인 페이지로 리디렉션
        res.redirect("/login");

    } catch (error) {
        console.error("DB 에러남 : ", error);
        res.send("Error during signup.");
    } finally {
        if (con) con.release(); // 연결 해제
    }
});

// 로그인 여부 확인 미들웨어
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next(); // 로그인된 경우 다음 미들웨어 실행
    } else {
        res.redirect("/login"); // 로그인되지 않은 경우 로그인 페이지로 리디렉션
    }
}

// 보호된 대시보드 라우트
app.get("/dashboard", isAuthenticated, (req, res) => {
    res.render("dashboard", { user: req.session.user });
});

app.get("/login", (req, res) => {
    res.render("login"); // login.ejs 템플릿 렌더링
});

app.post("/login", async (req, res) => {
    let con;
    const { username, password } = req.body;
    try {
        con = await connectPool.getConnection();
        const user = await con.query("SELECT * FROM users WHERE username = ? AND password = ?", [username, password]);
        if (user.length > 0) {
            req.session.user = user[0]; // 세션에 사용자 정보 저장
            res.redirect("/dashboard"); // 로그인 성공 후 대시보드로 리디렉션
        } else {
            res.send("Invalid credentials."); // 로그인 실패
        }
    } catch (error) {
        console.error("DB 에러남 : ", error);
        res.send("Error logging in.");
    } finally {
        if (con) con.release();
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.send("Error logging out.");
        }
        res.redirect("/"); // 로그아웃 후 로그인 페이지로 리디렉션
    });
});

// 게시물 작성 페이지
app.get("/board/create", (req, res) => {
    res.render("create");
});

app.post("/board/create", async (req, res) => {
    let con;
    const { writer, title, content } = req.body;
    try {
        con = await connectPool.getConnection();
        await con.query(`INSERT INTO board (writer, title, content) VALUES ('${writer}', '${title}', '${content}')`);
        res.redirect("/");
    } catch (error) {
        console.error("DB 에러남 : ", error);
        res.send("Error creating the post.");
    } finally {
        if (con) con.release();
    }
});

// 게시물 상세 페이지
app.get("/board/:id", async (req, res) => {
    let con;
    const boardId = req.params.id;
    try {
        con = await connectPool.getConnection();
        const board = await con.query("SELECT * FROM board WHERE id = ?", [boardId]);
        const comments = await con.query("SELECT * FROM comment WHERE board_id = ?", [boardId]);
        if (board.length > 0) {
            res.render("board", { board: board[0], comments });
        } else {
            res.send("Board not found.");
        }
    } catch (error) {
        console.error("DB 에러남 : ", error);
        res.send("Error loading the board.");
    } finally {
        if (con) con.release();
    }
});

// 게시물 수정 페이지
app.get("/board/edit/:id", async (req, res) => {
    let con;
    const boardId = req.params.id;
    try {
        con = await connectPool.getConnection();
        const board = await con.query("SELECT * FROM board WHERE id = ?", [boardId]);
        if (board.length > 0) {
            res.render("edit", { board: board[0] });
        } else {
            res.send("Board not found.");
        }
    } catch (error) {
        console.error("DB 에러남 : ", error);
        res.send("Error loading the edit page.");
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
        res.send("Error updating the board.");
    } finally {
        if (con) con.release();
    }
});

// 게시물 삭제
app.post("/board/delete/:id", async (req, res) => {
    let con;
    const boardId = req.params.id;
    try {
        con = await connectPool.getConnection();
        await con.query("DELETE FROM board WHERE id = ?", [boardId]);
        res.redirect("/");
    } catch (error) {
        console.error("DB 에러남 : ", error);
        res.send("Error deleting the board.");
    } finally {
        if (con) con.release();
    }
});
