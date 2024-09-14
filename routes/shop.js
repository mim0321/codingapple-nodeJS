/** Router
 * API들을 route라고도 함
 * 'router는 누군가를 이리저리 안내하는 기계'
 * 
 * db사용법 & 아래는 라우터 사용 방법
 */

// database.js를 사용하기 위해서 require로 경로 지정해주고
// 변수에 등록 후 .then 앞에 변수로 넣어주면 사용 끝!
let connectDB = require('./../database.js')

let db;
connectDB.then((client)=>{
  db = client.db('forum')
}).catch((err)=>{
  console.log(err)
})

// 라우터 사용방법
const router = require('express').Router()

// 공통된 URL 시작 부분은 축약이 가능함
// server.js에서 app.use의 URL에 /shop을 적어주면
// 원래 /shop/shirts에서 /shirts만 적어줘도 축약이 가능
router.get('/shirts', (req, res) => {
    res.send('셔츠 파는 페이지임')
  })

router.get('/pants', (req, res) => {
    res.send('바지 파는 페이지임')
  })

// exports했으면 import도 해야함
// server.js로 require하면 됨
module.exports = router