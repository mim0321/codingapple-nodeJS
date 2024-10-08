const express = require('express')
const app = express()
const { ObjectId } = require('mongodb')

// override npm 세팅
const methodOverride = require('method-override')

// override npm 세팅
app. use(methodOverride('_method'))

app.use(express.static(__dirname + '/public'))

// ejs npm 사용설정
app.set('view engine', 'ejs')

// req.body 사용하기 전 세팅
// 2. 서버는 글에 이상한거 없는지 검사함
app.use(express.json())
app.use(express.urlencoded({extended:true}))

// passport 라이브러리 세팅
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')

// bcrypt 사용
const bcrypt = require('bcrypt')

// 환경변수 dotenv
require('dotenv').config()

// login시 db에 저장하는 법
const MongoStore = require('connect-mongo')

app.use(passport.initialize())
app.use(session({
  secret: 'password',
  resave : false,
  saveUninitialized : false,
  // 유효기간 따로 설정하는 법(maxAge에 ms단위로 지정하면 됨
  cookie : { maxAge : 60 * 60 * 1000 },
  // connect-mongo 설정
  store : MongoStore.create({
    mongoUrl : process.env.DB_URL, // DB접속용 url
    dbName : 'forum', // DB이름
  })
}))
app.use(passport.session())

// passport 라이브러리, ID/PW가 DB랑 일치하는지 검증하는 로직 짜는 공간
// 아래 로직을 실행하고싶으면 passport.authenicate('local')() 작성하고 실행하면 됨
passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
  let result = await db.collection('user').findOne({ username : 입력한아이디})
  if (!result) {
    return cb(null, false, { message: '아이디 DB에 없음' })
  }

  // bcrypt로 해싱된 암호를 비교해주는 함수
  // bcrypt.compare(입력한암호, DB에 저장된 암호)
  if (await bcrypt.compare(입력한비번, result.password)) {
    return cb(null, result)
  } else {
    return cb(null, false, { message: '비번불일치' });
  }
}))

// passport 라이브러리, 세션만드는 코드
passport.serializeUser((user, done) => {
  process.nextTick(() => {
    done(null, /*세션 document에 기록할 내용*/
      { id : user._id, username : user.username })
  })
})

// passport 라이브러리, 유저가 보낸 쿠키를 분석하는 코드
passport.deserializeUser( async (user, done) => {
  // user내용을 그대로 보내버리면 최신정보가 맞지 않을 수 있기 때문에, db에서 한 번 검증하고 넘겨주는 것이 좋다.
  // findOne으로 user.id를 찾아서 result변수에 저장하고 result를 분석하는 것이 좋은 관습이다.
  let result = await db.collection('user').findOne({_id : new ObjectId(user.id)})
  // 하지만 result에는 PW도 있기 때문에(db data를 그대로 가져오니까) PW는 삭제시킨 후에 검증하자!
  delete result.password
  process.nextTick(() => {
    done(null, result)
  })
})

// multer(aws-s3 파일 업로드, 다운로드 관련 라이브러리)
const { S3Client } = require('@aws-sdk/client-s3')
const multer = require('multer')
const multerS3 = require('multer-s3')
const s3 = new S3Client({
  region : 'ap-northeast-2',
  credentials : {
      accessKeyId : process.env.awsAccessKey,
      secretAccessKey : process.env.awsSecretAccessKey,
  }
})

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'mim0321forum',
    key: function (요청, file, cb) {
      cb(null, Date.now().toString()) //업로드시 파일명 변경가능
    }
  })
})

const { MongoClient } = require('mongodb')

/**router마다 db가 필요하면 database.js에 db출력문을 저장해놓고 꺼내쓰면 됨
 * database.js 살펴볼 것
 * 갖다쓰는건 /routes/shop.js 살펴볼 것
 */
let connectDB = require('./database.js')

let db;
connectDB.then((client)=>{
  db = client.db('forum')
  app.listen(process.env.PORT, () => {
      console.log('http://localhost:8080 에서 서버 실행중')
  })
}).catch((err)=>{
  console.log(err)
})

/** <미들웨어>
 * js에서 어떤 반복되는 것들이 많으면 함수로 만들어서 짧게 사용하지않음?
 * node.js에서도 똑같이 가능함!
 * 예를 들어서 어떤 항목을 요청할 때 로그인이 되어있지 않으면 로그인 요청하는 기능을 거의 대부분의 요청에 사용해야하는데,
 * 이럴 때 함수로 만들어서 사용하면 존나 편리함
 * 사용법은 함수만들어서 갖다 쓰면 끝
 * 
 * 하지만 좀 더 멋있게 쓰려면
 * (req, res) 앞에 함수명 작성하면 됨 ()는 빼고
 * 작동원리는
 * 1. app.get('URL')을 요청하면~
 * 2. 미들웨어 함수를 실행하고,
 * 3. (req, res)응답을 실행해줘
 * 
 * 미들웨어 함수는 파라미터로 req, res, next 총 3개를 작성해야하고
 * 함수 마지막에는 next() 함수를 꼭 넣어줘야 중간에 무한루프에 걸리지 않음
 * 
 * 만약 미들웨어를 여러개 만들어서 여러개를 적용시키고 싶으면
 * 미들웨어 자리에 [](대괄호)를 넣고 그 안에 차례차례 넣으면 된다.
 * ex) [함수1, 함수2, 함수3....]
 * 
 * Q.API 100개에 미들웨어를 전부 다 적용하고 싶으면? >> 하나하나 다 작성하면 뒤지겠지..?
 * app.use(미들웨어함수)
 * 위 코드 아래에 있는 모든 API는 해당 미들웨어 함수를 전부 적용할 수 있다.
 * (+추가)
 * app.use('/URL', 미들웨어함수) url을 작성해주면 원하는 라우터에만 미들웨어를 적용할 수 있다.
 * get, post, put, delete 등등 해당 url이라면 전부 적용 됨(물론 app.use보다 아래에 있는 API들 중에서!)
 * 하위 URL(/URL/어쩌구, /URL/어쩌구/저쩌구, /URL/저저쩌구...)에도 전부 적용 된다.
 */
function checkLogin(req, res, next){
  if (!req.user){
    res.send('로그인 하세요!')
  }
  next()
}

// 오늘의 숙제(240911)
// Q1. 누가 /list로 시작하는 API로 요청 시 현재 시간을 터미널에 출력하고 싶으면?
// function을 따로 만들지 않고 app.use에서 직접 function 적어도 됨
app.use('/list', (req, res, next)=>{
  console.log(new Date());
  next()
})

// Q2.로그인시&회원가입시 유저가 아이디, 비번을 전송하고 있는데 아이디와 비번이 빈칸이면 그러지말라고 응답해주는 middleware를 만들어보기
function noText(req, res, next){
  if(req.body.username == '' || req.body.password == ''){
    res.send('빈칸이야 그러지마...')
  }
  next()
}

// req = request 요청
// res = response 응답
app.get('/', (req, res) => {
  // html파일을 유저에게 보내고 싶으면 sendFile로 한다.
  // __dirname == 현재경로(server.js가 위치한)
    res.sendFile(__dirname + '/index.html')
})

app.get('/news', (req, res) => {
    // DB와 연동 되었는지 확인 함
    db.collection('post').insertOne({title: '테스트 중'})
    res.send('{title:테스트중}이 DB에 저장 됨')
})

app.get('/list', checkLogin, async (req, res) => {
    let result = await db.collection('post').find().toArray()
    // await db.collection('post').find().toArray()
    //  >> db 컬렉션의 모든 document 출력 하는 문법
    // await == 다음줄 실행하기 전에 잠깐 기다려주세요~
    // awiat을 쓰기 위해서는 async를 넣어주어야 한다.

    // 글목록 페이지를 전송하고 싶으면
    // 그 글목록 페이지를 html로 만들어서 그 안에 데이터를 꽂아넣은 후에 html파일을 보내야함
    // 그걸 하고 싶으면 템플릿엔진을 쓰면 됨 >> 우린 제일 쉬운 ejs를 쓸거임
    // ejs파일은 기본적으로 views폴더 내부에 있어야 함. 기본 경로가 views이기 때문에 링크도 그냥 작성하면 됨
    // ejs를 쓰려면 sendFile이 아닌 render를 써야함

    /** [server side rendering]
     * 서버 데이터(mongoDB)를 ejs파일에 넣으려면 2가지 스텝을 따라야함
     * 1. ejs파일로 데이터를 먼저 보내야함
     *   >> render('ejs File', { Data }) 객체 형태로 데이터 꽂아주는 것이 관례
     * 2. ejs파일 안에서 <%= 데이터이름 %>으로 꽂아서 사용 가능
     */
    res.render('list.ejs', { list : result })
  })

  // 숙제 : /time으로 접속하면 현재 서버의 시간을 보내주는 기능 만들기
  app.get('/time', (req, res) => {
    console.log(new Date())
    res.render('time.ejs', { time : new Date() })
  }) // 숙제 끝

  /** 글 작성 기능 어케만들까?
   * <유저가 작성한 글을 DB에 저장해주기>
   * 1. 유저가 글 작성페이지에서 글을 써서 서버로 전송함
   * 2. 서버는 글에 이상한거 없는지 검사함
   * 3. 이상이 없으면 DB에 저장하기
   */

  // 1. 유저가 글 작성페이지에서 글을 써서 서버로 전송함
  app.get('/write', checkLogin, (req,res) => {
    try {
      console.log(req.user)
      res.render('write.ejs')
    } catch (error) {
      console.log(error)
      res.status(500).send('서버에러남')
    }
  })

  // 2. 서버는 글에 이상한거 없는지 검사함 == 상단 app.use에 있음

  // 3. 이상이 없으면 DB에 저장하기
  // write.ejs에서 이미지 업로드 >> upload.single('name') 미들웨어로 작성
  // 근데 이미지 에러나면 어떡함? 에러처리하는 법은 미들웨어 말고 따로 적어줘야함
  // get요청이 되면 req.file에 다양한 정보가 들어있음
  app.post('/newpost', upload.single('img1'), async (req,res) => {
    console.log(req.body)
    console.log(req.file)
    // 예외처리하는 방법
    /** try catch
     * try {실행} catch(e) {에러시 실행}
     * 1. try안에 있는 코드가 뭔가 에러가나면
     * 2. catch 안에 있는 코드를 대신 실행해줘
     */

    // 이미지 업로드 에러시 이렇게 작성
    // upload.single('img1')(req, res, (err)=>{
    //         if (err) return res.send('업로드 에러남');
    //         // 업로드 완료시 실행할 코드는 여기에 작성
    //       })

    try {
      // try안에 있는 코드가 뭔가 에러가 나게 되면
      if ( req.body.title == '' || req.body.content == '' ){
        res.send('작성하지 않은 부분이 있습니다.')
      } else {
        await db.collection('post').insertOne({
          title: req.body.title,
          content: req.body.content,
          // img: req.file.location,
          })
          res.redirect('/list')
        }
    } catch (e) {
      // catch 안에 있는 코드를 대신 실행해주는 유용한 문법
      // 센스있는 개발자는 서버 에러가 났을 때 status(500)을 추가하여 프론트 개발자에게 전달할 수 있게 함
      // console.log(e)로 터미널에서도 어떤 에러가 난건지 확인 가능함
      console.log(e)
      res.status(500).send('서버 에러 남')
    }

  })

  // 숙제 : 새로운페이지에 form태그를 활용하여 전송버튼 누르면 새로운 collection에 글 발행해주는 기능 제작
  app.get('/write2', (req,res) => {
    res.render('write2.ejs')
  })

  app.post('/newpost2', async (req,res) => {
    console.log(req.body)
    try{
      if(req.body.id == ''){
        res.send('아이디 입력 안하심')
      } else if(req.body.pw == ''){
        res.send('암호 입력 안하심')
      } else {
        await db.collection('post').insertOne({id: req.body.id, pw: req.body.pw})
        res.redirect('/write2')
      }
    } catch(e){
      console.log(e)
      res.status(500).send('서버 에러 남')
    }
  }) // 숙제 끝

  /** 상세페이지 어케 만들까? >> URL파라미터 문법 (:콜론사용 후 아무런 텍스트)
   * 1. 유저가 '/detail/어쩌구'로 접속하면
   * 2. {_id:어쩌구}글을 DB에서 찾아서
   * 3. ejs파일에 박아서 보내줌
   */

  // /detail/:text == url에다가 /detail/아무텍스트 를 입력하면 두번째 파라미터 콜백함수 안에 있는 코드 실행 가능함
  // 1. 유저가 '/detail/어쩌구'로 접속하면
  // 2. {_id:어쩌구}글을 DB에서 찾아서
  app.get('/detail/:id', async (req, res) => {
    // 3. ejs파일에 박아서 보내줌
    // await db.collection('post').findOne({데이터:값}) >> db collection 중에 '데이터:값'인 데이터를 찾아서 가져와 줌
    // objectId 쓰려면 상단에 이거 입력해야함 >> const { ObjectId } = require('mongodb')
    // url parameter 가져오는 방법은 'req.params.parameter'로 작성함
    try {
      console.log('params : ', req.params.id)
      let result = await db.collection('post').findOne({ _id : new ObjectId(req.params.id) })
      console.log('result : ', result)
      res.render('detail.ejs', {detail : result})
      if (result == null){
        res.status(404).send('이상한 url 입력함')
      }
    } catch(e) {
      console.log(e)
      res.status(404).send('이상한 url 입력함')
    }
  })

  /** 수정 페이지 만들어봅시다
   * 1. 수정버튼 누르면 수정페이지로 이동함
   * 2. 수정 페이지에는 기존에 작성된 글이 채워져 있음
   * 3. 전송버튼 누르면 입력한 내용으로 DB글 수정함
   */

  /** 데이터 수정 문법
   * db.collection('post').updateOne({어떤 document}, {$set : {어떤 내용으로 수정할지?}})
   * db.collection('post').updateOne({ a : 1 }, {$set : { a : 2 }})
   * post콜렉션에서 {a:1}이 들어있는 document를 찾아서 {a:2}로 덮어씌우겠음
   */
  app.get('/edit/:id', async (req,res) => {
    let result = await db.collection('post').findOne({ _id : new ObjectId(req.params.id) })
    res.render('edit.ejs', {postData : result})
  })

  app.put('/edit', async (req,res) => {
    await db.collection('post').updateOne(
      { _id : new ObjectId(req.body.id) },
      // $set == 덮어씌워줘
      { $set: { title : req.body.title, content : req.body.content } });
    res.redirect('/list')

    // updateMany == 첫번째 파라미터(셀렉터?)와 일치하는 모든 document를 찾아줌
    // 조건식을 넣고싶으면?
    // { _id : {$gt : 10} } == _id필드의 값이 10초과인 document를 찾아줘
    // $gt == 초과, $gte == 이상, $lt == 미만, $lte == 이하, $ne == 같지않음
    // await db.collection('post').updateMany(
    //   { _id : 1 },
    //   // $inc == 기존값에 +/- 하라는 뜻
    //   { $inc: { like : 1 } });

      /** 다양한 연산자
       * $mul == 곱해주셈
       * $unset == 필드값 삭제(위에서는 like)
       */
      // res.redirect('/list')
  })

  app.delete('/delete', async (req, res) => {
    await db.collection('post').deleteOne( { _id : new ObjectId(req.query.docid) } )
    res.send('삭제완료')
    // console.log(req.query)
  })

  /** <pagination 만들기>
   * 1 누르면 1~5번 글 보여줌(/list/1)
   * 2 누르면 6~10번 글 보여줌(/list/2)
   * 3 누르면 11~15번 글 보여줌(/list/3).... << url parmeter문법 활용
   */
  app.get('/list/:id', checkLogin, async (req, res) => {
    // 1~5번 글을 찾아서 result 변수에 저장
    // find().limit(i).toArray() == 모든 글을 찾는데, 첫번째부터 i개만 잘라서 arr에 넣어줘
    // find().skip(n).limit(i).toArray() == 모든 글을 찾는데, 첫번째부터 n개까지는 스킵하고 i개만 잘라서 arr에 넣어줘
    // skip() 같은 경우 단위가 클 경우 성능이 매우 느려질 수 있다.

    let result = await db.collection('post').find().skip((req.params.id - 1) * 5).limit(5).toArray()
    res.render('list.ejs', { list : result })
  })

  app.get('/list/next/:id', checkLogin, async (req, res) => {
  /** <페이지가 수천만개가 되어도 빠른 속도로 보여주는 방법>
   * find()함수 안에 조건문을 넣어서 보여주기
   * find({_id : {$gt : 방금 본 마지막 게시물의 id}})
   * 장점 : 매우 빠르다.
   * 단점 : '다음'버튼으로만 활용이 가능하다.
   */
  let result = await db.collection('post')
  .find({_id : {$gt : new ObjectId(req.params.id)}})
  .limit(5).toArray()
  res.render('list.ejs', { list : result })
  })

  /** <회원 기능 만들기>
   * sesstion방식 (DB에서 유저 정보 확인하는 방식)
   * passport 라이브러리 사용할거임
   * 1. 가입기능 만들고
   * 2. 로그인 기능 만들고
   * 3. 로그인 완료시 세션 만들고(세션에는 보통 document에 id,pw,유효기간 등등)
   * 4. 로그인 완료 시 유저에게 입장권을 보내 줌
   * 5. 로그인 여부를 확인하려면 입장권을 까보고 DB랑 비교해보면 됨
   */

  // 1. 가입기능 만들고 >> 나중에 숙제로 해볼 것(우선은 db에서 직접 발행해서 만듬)
  app.post('/signup', async(req, res) => {
    try {
      // 유저 이름 중복체크
      const result = await db.collection('user').find( {username : req.body.username} ).toArray()
      console.log(result)
      // 예외처리로 빈칸, 아이디 중복, 짧은암호 등등 만들자(숙제)
      if ( req.body.username == '' || req.body.password == '' ){
          res.send('작성하지 않은 부분이 있습니다.')
        } else if ( result != ''){
          res.send('중복된 아이디가 있습니다.')
        } else if ( req.body.password != req.body.checkPassword ){
          res.send('암호가 일치하지 않습니다.')
        } else {
          // 비번 해싱화하기
          // bcrypt.hash('해싱할 문자', 단계) >> 단계는 1~15 가능
          let hash = await bcrypt.hash(req.body.password, 10)

          await db.collection('user').insertOne({
            username: req.body.username,
            password: hash
          })
          console.log('가입완료!')
          res.redirect('/login')
        }
    } catch (e) {
      console.log(e)
      res.status(500).send('서버 에러 남')
    }
  })

  // 2. 로그인 기능 만들고
  app.get('/login', async(req, res) => {
    if(req.user != undefined){
      res.redirect('/')
    } else {
      res.render('login.ejs')
    }
  })

  app.post('/login', async(req, res, next) => {
    // 두번째파라미터네 콜백함수 만들고 error, user, info를 파라미터로 입력함
    // error : 에러가 나면 뭔가가 들어옴
    // user : 아이디,비번 검증이 완료된 유저 정보가 들어옴
    // info : 아이디,비번 검증 실패시 에러메세지가 들어옴
    passport.authenticate('local', (error, user, info)=>{
      // error가 나면 실행할 것
      if (error) return res.status(500).json(error)
      // 아이디,비번 검증 실패시 실행할 것
      if (!user) return res.status(401).json(info.message)
      // 아이디,비번 검증 성공하면 실행할 것
      req.logIn(user, (err)=>{
        // 검증까지 성공했어도 에러가 날 수 있다고 함. 그래서 작성함
        if (err) return next(err)
        // 로그인 완료되면 실행할 것. 여기서는 home으로 이동하게 함
        res.redirect('/')
      })
    })(req, res, next)
  })

  // myPage 만들기 숙제
  app.get('/mypage', async(req, res) => {
    console.log(req.user)
    if(req.user == undefined){
      res.send('잘못된 접근입니다.')
    } else {
      const result = req.user
      res.render('mypage.ejs', { result : result })
    }
  })

  /**오늘의 숙제(240910)
   * 1. 회원가입 시 중복체크
   * 2. 암호 일치 확인칸 만들기
   * 3. 로그인한 사람만 글작성하게 만들어보기
   */

  // router 갖다쓰기(상단에 쓰는 게 좋을 듯?)
  // 공통된 URL 앞부분은 메인서버에서 작성해주면 축약이 가능함
  app.use('/shop', require('./routes/shop.js'))

  /** 검색기능 활성화
   * 1. input에 텍스트를 적고 검색버튼을 누르면
   * 2. 텍스트를 서버에 보낸 후
   * 3. 서버가 그 텍스트가 포함되어있는 Document를 찾음
   * 4. document를 다시 search/list에 보내고,
   * 5. obj를 출력함
   */

  // 정규식 사용하면 일부 텍스트만으로도 찾을 수 있음
  // 정규식은 {$regex : ???}
  // find()로 찾으면 마찬가지로 존나 느림 그래서 Binary search 같은거 하면 좋음
  // binary search를 쓰려면 index가 미리 정렬되어있어야함(그래야 절반씩 자르니까)
  // index == 검색 등을 위해 데이터를 복사해서 미리 정렬해놓은 것

  // app.get('/search', async (req, res) => {
  //   const result = await db.collection('post').find({ title : {$regex : req.query.val} }).toArray()
  //   console.log(result)
  //   res.render('list.ejs', { list : result })
  // })

  // index를 사용해서 검색하려면 아래 코드로
  // 근데 한글은 사실 이거 쓸데없어서 search index(full text index)를 만들어서 써야함ㅇㅇ
  // app.get('/search', async (req, res) => {
  //   const result = await db.collection('post').find({$text : {$search : req.query.val}}).toArray()
  //   // .find() 성능 평가 하려면 .toArray()가 아니라 explain('excutionStats') 사용
  //   console.log(result)
  //   res.render('list.ejs', { list : result })
  // })

  /** search index 동작원리
   * 1. 문장에서 조사, 불용어 등을 제거(s, and, The, !, 을, 를, 이, 가 등등)
   * 2. 모든 단어들을 뽑아서 정렬함
   * 3. 해당 단어들이 어떤 document에 있었는지 id등을 지정해서 따로 저장함
   * .find() 대신에 .aggregate()를 사용함. 이건 조건들을 여러개 넣을 수 있는 장점이 있음
   */
  app.get('/search', async (req, res) => {
    let search = [
      {$search : {
        index : 'title_index',
        text : { query : req.query.val, path : 'title' }
      }},
      {$sort : { _id : 1 }},
      {$limit : 10},
      // {$skip : n}, {조건4...}
      // limit이랑 skip을 잘쓰면 검색내용 페이지네이션도 응용 가능하겠쥬?
      // {$project : {title : 1}} >> 필드 값을 숨기고 싶을 때 0은 숨기고, 1은 보여주기
    ]
    const result = await db.collection('post').aggregate(search).toArray()
    console.log(result)
    res.render('list.ejs', { list : result })
  })