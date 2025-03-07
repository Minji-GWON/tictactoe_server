var express = require('express');
var router = express.Router();
var bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
var saltrounds = 10;

var ResponseType = {
  INVALID_USERNAME: 0,
  INVALID_PASSWORD: 1,
  SUCCESS: 2
}

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

// 회원가입
router.post('/signup', async function(req, res, next) {
  try {
    var username = req.body.username;
    var password = req.body.password;
    var nickname = req.body.nickname;

    // 입력값 검증
    if (!username || !password || !nickname) {
      return res.status(400).send("모든 필드를 입력해주세요");
    }

    // 사용자 중복 체크
    var database = req.app.get('database');
    var users = database.collection('users');
   
    const existingUser = await users.findOne({ username: username });
    if (existingUser) {
      return res.status(409).send("이미 존재하는 사용자입니다");
    }
    // 비밀번호 암호화
    var salt = bcrypt.genSaltSync(saltrounds);
    var hash = bcrypt.hashSync(password, salt);
    // DB에 저장
    await users.insertOne({
      username: username,
      password: hash, // 해시된 비밀번호 저장
      nickname: nickname
    });
    res.status(201).send("사용자가 성공적으로 생성되었습니다");
  } catch (err) {
    console.error("사용자 추가 중 오류 발생:", err);
    res.status(500).send("서버 오류가 발생했습니다");
  }
});

// 로그인 API 수정 (/users/signin)
router.post("/signin", async function (req, res, next) {
  try {
    var username = req.body.username;
    var password = req.body.password;

    var database = req.app.get("database");
    var users = database.collection("users");

    if (!username || !password) {
      return res.status(400).send("모든 필드를 입력해주세요.");
    }

    const existingUser = await users.findOne({ username: username });
    if (!existingUser) {
      return res.json({ result: ResponseType.INVALID_USERNAME });
    }

    var compareResult = bcrypt.compareSync(password, existingUser.password);
    if (!compareResult) {
      return res.json({ result: ResponseType.INVALID_PASSWORD });
    }

    // 세션 저장
    req.session.isAuthenticated = true;
    req.session.userId = existingUser._id.toString();
    req.session.username = existingUser.username;
    req.session.nickname = existingUser.nickname;

    // 세션 쿠키를 클라이언트에 전달
    res.json({
      result: ResponseType.SUCCESS,
      sessionId: req.sessionID,  // 클라이언트에서 저장할 세션 ID
    });
  } catch (err) {
    console.error("로그인 중 오류 발생.", err);
    res.status(500).send("서버 오류가 발생했습니다.");
  }
});

//자동 로그인 API 추가
router.get("/auto-login", async function (req, res, next) {
  try {
    if (!req.session.isAuthenticated) {
      return res.status(401).json({ message: "로그인이 필요합니다." });
    }

    var database = req.app.get("database");
    var users = database.collection("users");

    const user = await users.findOne({ username: req.session.username });

    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    res.json({
      id: user._id.toString(),
      username: user.username,
      nickname: user.nickname,
      score: user.score || 0,
    });
  } catch (err) {
    console.error("자동 로그인 처리 중 오류 발생:", err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});



// 로그아웃
router.post('/signout', function(req, res, next) {
  req.session.destroy((err) => {
    if (err) {
      console.log("로그아웃 중 오류 발생");
      return res.status(500).send("서버 오류가 발생했습니다.");
    }
    res.status(200).send("로그아웃 되었습니다.");
  });
});

// 점수 추가 (게임 승리 시 +10점)
router.post('/addscore', async function(req, res, next) {
  try {
    if (!req.session.isAuthenticated) {
      return res.status(403).send("로그인이 필요합니다.");
    }
    var userId = req.session.userId;
    var scoreToAdd = req.body.score; // 추가할 점수

    if (!scoreToAdd || isNaN(scoreToAdd)) {
      return res.status(400).send("유효한 점수를 입력해주세요.");
    }

    var database = req.app.get('database');
    var users = database.collection('users');

    const result = await users.updateOne(
      { _id: ObjectId.createFromHexString(userId) },
      { $inc: { score: Number(scoreToAdd) } } // 현재 점수에 scoreToAdd 만큼 추가
    );

    if (result.matchedCount === 0) {
      return res.status(400).send("사용자를 찾을 수 없습니다.");
    }

    res.status(200).json({ message: "점수가 성공적으로 업데이트 되었습니다." });
  } catch (err) {
    console.error("점수 추가 중 오류 발생: ", err);
    res.status(500).send("서버 오류가 발생했습니다.");
  }
});

// 점수 조회 API (로그인한 유저만 사용 가능)
router.get('/score', async function(req, res, next) {
  try {
    if (!req.session.isAuthenticated) {
      return res.status(403).send("로그인이 필요합니다.");
    }

    var userId = req.session.userId;
    var database = req.app.get('database');
    var users = database.collection('users');

    // 유저 정보 조회
    const user = await users.findOne({ username: req.session.username });

    if (!user) {
      return res.status(404).send("사용자를 찾을 수 없습니다.");
    }

    res.json({
      id: user._id.toString(),
      username: user.username,
      nickname: user.nickname,
      score: user.score || 0
    });
  } catch (err) {
    console.error("점수 조회 중 오류 발생: ", err);
    res.status(500).send("서버 오류가 발생했습니다.");
  }
});

// 전체 유저 리더보드 API + 내 순위 포함
router.get('/leaderboard', async function(req, res, next) {
  try {
    var database = req.app.get('database');
    var users = database.collection('users');

    // 모든 유저 점수 조회 (점수 내림차순 정렬)
    const leaderboard = await users.find({}, { projection: { username: 1, nickname: 1, score: 1 } })
      .sort({ score: -1 })
      .toArray();

    let myRank = null;
    if (req.session.isAuthenticated) {
      const myUsername = req.session.username;
      myRank = leaderboard.findIndex(user => user.username === myUsername) + 1; // 순위는 1부터 시작
    }

    res.status(200).json({
      leaderboard: leaderboard,
      myRank: myRank
    });

  } catch (err) {
    console.error("리더보드 조회 중 오류 발생:", err);
    res.status(500).send("서버 오류가 발생했습니다.");
  }
});

module.exports = router;