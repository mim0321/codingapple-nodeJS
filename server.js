const express = require('express')
const app = express()
const { ObjectId } = require('mongodb')

app.use(express.static(__dirname + '/public'))

// ejs npm 사용설정
app.set('view engine', 'ejs')

// 요청.body 사용하기 전 세팅
// 2. 서버는 글에 이상한거 없는지 검사함
app.use(express.json())
app.use(express.urlencoded({extended:true}))



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


app.get('/', (요청, 응답) => {
  // html파일을 유저에게 보내고 싶으면 sendFile로 한다.
  // __dirname == 현재경로(server.js가 위치한)
    응답.sendFile(__dirname + '/index.html')
})

app.get('/news', (요청, 응답) => {
    // DB와 연동 되었는지 확인 함
    db.collection('post').insertOne({title: '테스트 중'})
    응답.send('{title:테스트중}이 DB에 저장 됨')
})

app.get('/list', async (요청, 응답) => {
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
    응답.render('list.ejs', { list : result })
  })

  // 숙제 : /time으로 접속하면 현재 서버의 시간을 보내주는 기능 만들기
  app.get('/time', (요청, 응답) => {
    console.log(new Date())
    응답.render('time.ejs', { time : new Date() })
  }) // 숙제 끝

  /** 글 작성 기능 어케만들까?
   * <유저가 작성한 글을 DB에 저장해주기>
   * 1. 유저가 글 작성페이지에서 글을 써서 서버로 전송함
   * 2. 서버는 글에 이상한거 없는지 검사함
   * 3. 이상이 없으면 DB에 저장하기
   */

  // 1. 유저가 글 작성페이지에서 글을 써서 서버로 전송함
  app.get('/write', (요청,응답) => {
    응답.render('write.ejs')
  })

  // 2. 서버는 글에 이상한거 없는지 검사함 == 상단 app.use에 있음

  // 3. 이상이 없으면 DB에 저장하기
  app.post('/newpost', async (요청,응답) => {
    console.log(요청.body)

    // 예외처리하는 방법
    /** try catch
     * try {실행} catch(e) {에러시 실행}
     * 1. try안에 있는 코드가 뭔가 에러가나면
     * 2. catch 안에 있는 코드를 대신 실행해줘
     */
    try {
      // try안에 있는 코드가 뭔가 에러가 나게 되면
      if ( 요청.body.title == '' || 요청.body.content == '' ){
          응답.send('작성하지 않은 부분이 있습니다.')
        } else {
          await db.collection('post').insertOne({title: 요청.body.title, content: 요청.body.content})
          응답.redirect('/list')
        }
    } catch (e) {
      // catch 안에 있는 코드를 대신 실행해주는 유용한 문법
      // 센스있는 개발자는 서버 에러가 났을 때 status(500)을 추가하여 프론트 개발자에게 전달할 수 있게 함
      // console.log(e)로 터미널에서도 어떤 에러가 난건지 확인 가능함
      console.log(e)
      응답.status(500).send('서버 에러 남')
    }

  })

  // 숙제 : 새로운페이지에 form태그를 활용하여 전송버튼 누르면 새로운 collection에 글 발행해주는 기능 제작
  app.get('/write2', (요청,응답) => {
    응답.render('write2.ejs')
  })

  app.post('/newpost2', async (요청,응답) => {
    console.log(요청.body)
    try{
      if(요청.body.id == ''){
        응답.send('아이디 입력 안하심')
      } else if(요청.body.pw == ''){
        응답.send('암호 입력 안하심')
      } else {
        await db.collection('post').insertOne({id: 요청.body.id, pw: 요청.body.pw})
        응답.redirect('/write2')
      }
    } catch(e){
      console.log(e)
      응답.status(500).send('서버 에러 남')
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
  app.get('/detail/:id', async (요청, 응답) => {
    // 3. ejs파일에 박아서 보내줌
    // await db.collection('post').findOne({데이터:값}) >> db collection 중에 '데이터:값'인 데이터를 찾아서 가져와 줌
    // objectId 쓰려면 상단에 이거 입력해야함 >> const { ObjectId } = require('mongodb')
    // url parameter 가져오는 방법은 '요청.params.parameter'로 작성함
    try {
      console.log('params : ', 요청.params.id)
      let result = await db.collection('post').findOne({ _id : new ObjectId(요청.params.id) })
      console.log('result : ', result)
      응답.render('detail.ejs', {detail : result})
      if (result == null){
        응답.status(404).send('이상한 url 입력함')
      }
    } catch(e) {
      console.log(e)
      응답.status(404).send('이상한 url 입력함')
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
  app.get('/edit/:id', async (요청,응답) => {
    let result = await db.collection('post').findOne({ _id : new ObjectId(요청.params.id) })
    응답.render('edit.ejs', {postData : result})
  })

  app.post('/edit', async (요청,응답) => {
    let result = await db.collection('post').updateOne(
      { _id : new ObjectId(요청.body.id) },
      { $set: { title : 요청.body.title, content : 요청.body.content } });
    응답.redirect('/list')
    console.log(result)
  })