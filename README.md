# practice_for_sequelize_transaction_230706
config/config.json 파일 제외됨

트랜잭션 예제와 사용자 이름 변경 API 구현

로직
1. 게시글을 작성하려는 클라이언트가 로그인된 사용자인지 검증한다.
2. 변경할 이름(name)을 body로 전달받는다.
3. 사용자의 현재 이름(name)을 조회한다.
4. 사용자 정보 테이블(UserInfos)에서 사용자의 이름(name)을 수정한다.
5. 사용자의 이름이 변경된 이력을 사용자 히스토리(UserHistories) 테이블에 저장한다.
6. 사용자 이름 변경 API 완료
