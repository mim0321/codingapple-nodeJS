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

app.use(passport.initialize())
app.use(session({
  secret: 'password',
  resave : false,
  saveUninitialized : false,
  // 유효기간 따로 설정하는 법(maxAge에 ms단위로 지정하면 됨
  cookie : { maxAge : 60 * 60 * 1000 }
}))
app.use(passport.session())

// passport 라이브러리, ID/PW가 DB랑 일치하는지 검증하는 로직 짜는 공간
// 아래 로직을 실행하고싶으면 passport.authenicate('local')() 작성하고 실행하면 됨
passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
  let result = await db.collection('user').findOne({ username : 입력한아이디})
  if (!result) {
    return cb(null, false, { message: '아이디 DB에 없음' })
  }
  if (result.password == 입력한비번) {
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


const { MongoClient } = require('mongodb')

let db
const url = 'mongodb+srv://admin:!mdlaodlf9@cluster0.tsxpd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
new MongoClient(url).connect().then((client)=>{
  console.log('DB연결성공')
  db = client.db('forum')
  app.listen(8080, () => {
      console.log('http://localhost:8080 에서 서버 실행중')
  })
}).catch((err)=>{
  console.log(err)
})

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

app.get('/list', async (req, res) => {
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
  app.get('/write', (req,res) => {
    res.render('write.ejs')
  })

  // 2. 서버는 글에 이상한거 없는지 검사함 == 상단 app.use에 있음

  // 3. 이상이 없으면 DB에 저장하기
  app.post('/newpost', async (req,res) => {
    console.log(req.body)

    // 예외처리하는 방법
    /** try catch
     * try {실행} catch(e) {에러시 실행}
     * 1. try안에 있는 코드가 뭔가 에러가나면
     * 2. catch 안에 있는 코드를 대신 실행해줘
     */
    try {
      // try안에 있는 코드가 뭔가 에러가 나게 되면
      if ( req.body.title == '' || req.body.content == '' ){
          res.send('작성하지 않은 부분이 있습니다.')
        } else {
          await db.collection('post').insertOne({title: req.body.title, content: req.body.content})
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
  app.get('/list/:id', async (req, res) => {
    // 1~5번 글을 찾아서 result 변수에 저장
    // find().limit(i).toArray() == 모든 글을 찾는데, 첫번째부터 i개만 잘라서 arr에 넣어줘
    // find().skip(n).limit(i).toArray() == 모든 글을 찾는데, 첫번째부터 n개까지는 스킵하고 i개만 잘라서 arr에 넣어줘
    // skip() 같은 경우 단위가 클 경우 성능이 매우 느려질 수 있다.

    let result = await db.collection('post').find().skip((req.params.id - 1) * 5).limit(5).toArray()
    res.render('list.ejs', { list : result })
  })

  app.get('/list/next/:id', async (req, res) => {
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

  // 2. 로그인 기능 만들고
  app.get('/login', async(req, res) => {
    console.log(req.user)
    res.render('login.ejs')
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

  // myPage 숙제
  app.get('/mypage', async(req, res) => {
    console.log(req.user)
    res.render('login.ejs')
  })