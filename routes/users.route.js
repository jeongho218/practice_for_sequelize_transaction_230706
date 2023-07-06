const express = require('express');
const jwt = require('jsonwebtoken');
const { Users, UserInfos, sequelize, UserHistories } = require('../models');
const router = express.Router();
const { Transaction } = require('sequelize');
const authMiddleware = require('../middlewares/auth-middleware');

// 회원가입
router.post('/users', async (req, res) => {
  const { email, password, name, age, gender, profileImage } = req.body;
  const isExistUser = await Users.findOne({ where: { email } });

  if (isExistUser) {
    return res.status(409).json({ message: '이미 존재하는 이메일입니다.' });
  }

  // 1. 트랜잭션 객체 할당
  // 여러 트랜잭션이 동시에 처리될 때 다른 트랜잭션에서 변경 및 조회하는 데이터를 읽을 수 있도록 허용하거나 거부하는 것을 결정하는 격리 수준(isolation level)을 설정할 수 있음
  const t = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    // 격리 수준을 READ_COMMITTED로 설정, '커밋 되지 않은 읽기'를 허용하는 격리 수준, 가장 낮은 수준의 격리이며, 락을 걸지 않아 동시성이 높지만 일관성이 쉽게 깨딜 수 있다.
  });

  try {
    // Users 테이블에 사용자를 추가합니다.
    const user = await Users.create({ email, password }, { transaction: t });
    // UserInfos 테이블에 사용자 정보를 추가합니다.
    const userInfo = await UserInfos.create(
      {
        UserId: user.userId, // 생성한 유저의 userId를 바탕으로 사용자 정보를 생성합니다.
        name,
        age,
        gender: gender.toUpperCase(), // 성별을 대문자로 변환합니다.
        profileImage,
      },
      {
        transaction: t,
      }
    );
    // 위 모든 로직이 완료된 경우 commit
    await t.commit();
  } catch (transactionError) {
    // 트랜잭션 내에서 작업이 실패한 경우
    await t.rollback(); // DB를 트랜잭션 작업 내용 적용 전으로 되돌린다.
    return res
      .status(400)
      .json({ errorMessage: '유저 생성에 실패하였습니다.' });
  }

  return res.status(201).json({ message: '회원가입이 완료되었습니다.' });
});

// 로그인
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await Users.findOne({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: '존재하지 않는 이메일입니다.' });
  } else if (user.password !== password) {
    return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
  }

  const token = jwt.sign(
    {
      userId: user.userId,
    },
    'customized-secret-key'
  );
  res.cookie('authorization', `Bearer ${token}`);
  return res.status(200).json({ message: '로그인 성공' });
});

// 사용자 조회
router.get('/users/:userId', async (req, res) => {
  const { userId } = req.params;

  const user = await Users.findOne({
    attributes: ['userId', 'email', 'createdAt', 'updatedAt'],
    include: [
      {
        model: UserInfos, // 1:1 관계를 맺고있는 UserInfos 테이블을 조회합니다.
        attributes: ['name', 'age', 'gender', 'profileImage'],
      },
    ],
    where: { userId },
  });

  return res.status(200).json({ data: user });
});

// 사용자 이름 변경 API
router.put('/users/name', authMiddleware, async (req, res) => {
  const { name } = req.body; // 변경할 이름
  const { userId } = res.locals.user;

  const userInfo = await UserInfos.findOne({ where: { userId } });
  // UserInfos DB에서 userId가 일치하는 사용자를 변수 userInfo에 할당
  const beforeName = userInfo.name; // 해당 사용자의 정보 중 name을 변수 beforeName에 할당

  // 트랜잭션으로 비즈니스 로직 수행
  // 1. 트랜잭션 발급
  const t = await sequelize.transaction({
    // 격리 수준을 READ_COMMITTED로 설정, '커밋 되지 않은 읽기'를 허용하는 격리 수준
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
  });

  try {
    // 사용자 정보 테이블에 있는 이름 변경
    await UserInfos.update(
      { name: name },
      { where: { userId }, transaction: t } // userId가 일치하는 대상에 트랜잭션을 통해 쿼리를 수행한다.
    );

    // 사용자의 변경된 이름 내역을 UserHistories 테이블에 삽입
    await UserHistories.create(
      {
        UserId: userId,
        beforeName: beforeName,
        afterName: name,
      },

      { transaction: t } // 트랜잭션을 통해서 쿼리를 수행한다.
    );

    await t.commit(); // 모든 비즈니스 로직이 성공하였다면, DB에 반영해라
  } catch (transactionError) {
    console.error(transactionError);
    await t.rollback(); // 비즈니스 로직에 실패하였다면 롤백한다.
    return res
      .status(400)
      .json({ errorMessage: '유저 이름 변경에 실패하였습니다.' });
  }

  return res.status(200).json({ message: '유저 이름 변경에 성공하였습니다.' });
});

module.exports = router;
