(function(){
var GAS='https://script.google.com/macros/s/AKfycbyZTbVby_nfOn52pQuAn8Anb418Mx_b5J-r4HRV4tx1CAK7EOpxfV101Ike4mTFNFQ0/exec';
var ts=Date.now(),d='2026-06-11';
var fTGW='f-rec-tgw',fT25='f-rec-t25',fYGK='f-rec-ygk';
var fBPG='f-rec-bpg',fN26='f-rec-n26',fICH='f-rec-ich',fSGU='f-rec-sgu',fN25='f-rec-n25',fSMC='f-rec-smc';
var fSSM='f-rec-ssm',fUNS='f-rec-uns',fSSG='f-rec-ssg',fPGW='f-rec-pgw';
var fCJG='f-rec-cjg',fETC='f-rec-etc',fGTU='f-rec-gtu';
function tn(sid,n){return {id:'t-rec-'+sid,type:'sheet',name:n,sheetId:sid};}
var U={
  58:'https://docs.google.com/spreadsheets/d/1SbaGCTWy6idcOKyOzRFIS5mLsSbpIhAOJnF_CxVSn2Q/edit',
  39:'https://docs.google.com/spreadsheets/d/19JUFY6rPKeHL6-488sOypvOIWz7EIpGiXTAuM---i9U/edit',
  52:'https://docs.google.com/spreadsheets/d/16-S10z-dO7s1ShZEgv-V2NWZWud8hHv-HN88CQroqg8/edit',
  59:'https://docs.google.com/spreadsheets/d/11sZ1m_H7kV8RgEy7U3Qi2fRlHykd7jBTCtv5C2MR2cM/edit',
  32:'https://docs.google.com/spreadsheets/d/18hxWAPTXj-3SNoqrU16rdmXT1KFFFXIHR0Psi6_GAnA/edit',
  53:'https://docs.google.com/spreadsheets/d/1VGZbqgEWG1hsZvGYLJmhx_03k6S-n1PIdUf71qw3DsQ/edit',
  31:'https://docs.google.com/spreadsheets/d/15JKj43zd1M2HgmvX5Vh5zHEwADYfMH6KtOViaJRmcus/edit',
  36:'https://docs.google.com/spreadsheets/d/1lnmu3XOm_e_PMz8Gz7BlhDDuemDj9SnQSkVxyVruoSM/edit',
  28:'https://docs.google.com/spreadsheets/d/1bL-oPW0BUlgWZUYoO6bM4nu4KKHa5E_K79o5v4TKDqE/edit',
  74:'https://docs.google.com/spreadsheets/d/1chykvtzYREtMr94CTZCCmTYWEgy0_x0aizApW95n5m4/edit'
};
function sd(i,n,fav,pin){return {id:i,title:n,desc:'',owner:'나(PM)',updated:d,tags:[],isPinned:!!pin,isFavorite:!!fav,access:'public',status:'active',link:U[i]||''};}
var treeData=[
  {id:fTGW,type:'folder',name:'투검위',expanded:false,children:[
    tn(58,'3차 투검위 폴더링'),
    {id:fT25,type:'folder',name:'25년투검위',expanded:false,children:[
      tn(25,'1분과 평가표 및 의견 취합본'),tn(26,'2분과 평가표 및 의견 취합본'),
      tn(70,'(참고) 25년 4차 투검위 결과 안내'),tn(71,'(참고) 25년 5차 투검위 결과 안내'),tn(72,'(참고) 25년 6차 투검위 결과 안내')
    ]}
  ]},
  {id:fYGK,type:'folder',name:'요건검토',expanded:false,children:[
    tn(16,'(립스2)1차 요건검토'),tn(33,'립스1 응답 시트'),tn(37,'립스1 요건검토'),tn(40,'(립스2)2차 요건검토'),tn(57,'3차 요건검토')
  ]},
  {id:fBPG,type:'folder',name:'발표평가',expanded:false,children:[
    tn(52,'발표평가 분과구성 자동화'),tn(54,'간사 역평가'),
    {id:fN26,type:'folder',name:'26년',expanded:false,children:[
      {id:fICH,type:'folder',name:'1차',expanded:false,children:[
        tn(29,'26 1차 평가표_1분과'),tn(30,'26 1차 평가표 2분과'),tn(73,'26년 1차 운영양식'),tn(74,'26년 립스2 1차 발표평가 총합')
      ]},
      {id:fSGU,type:'folder',name:'신규 운영사',expanded:false,children:[
        tn(75,'26년 신규운영사 발표 SHEET'),tn(76,'26년 신규운영사 발표평가 참고자료'),tn(77,'26년 1차 모집공고 Q&A 정리')
      ]}
    ]},
    {id:fN25,type:'folder',name:'25년',expanded:false,children:[tn(27,'25년 5차 평가표')]},
    {id:fSMC,type:'folder',name:'3차',expanded:false,children:[tn(61,'3차 발표평가 양식')]}
  ]},
  {id:fSSM,type:'folder',name:'사업설명회',expanded:false,children:[]},
  {id:fUNS,type:'folder',name:'운영사',expanded:false,children:[
    tn(34,'2026 운영사 추천권 총괄'),tn(56,'2026 운영사 관리 sheet'),tn(78,'26년 립스 운영사 관리시트')
  ]},
  {id:fSSG,type:'folder',name:'소상공인',expanded:false,children:[tn(35,'2026 소상공인 관리 sheet')]},
  {id:fPGW,type:'folder',name:'평가위원',expanded:false,children:[tn(15,'26립스 평가위원 섭외')]},
  {id:fCJG,type:'folder',name:'최종점검 및 정산',expanded:false,children:[
    tn(28,'현물 현황'),tn(79,'25년 4차 최종점검 양식'),tn(80,'최종 사업계획서'),tn(81,'정산 및 보고서')
  ]},
  {id:fETC,type:'folder',name:'ETC. (공부, 자료 등)',icon:'setting',expanded:false,children:[
    tn(31,'메모'),tn(32,'회의록 주제'),tn(36,'1팀 일정표'),tn(39,'스프레드시트 매니저 DB'),
    tn(53,'☆kaia 사무국'),tn(55,'립스1팀 복기'),tn(59,'분과구성 자동화'),tn(82,'발표평가 SHEET 세팅 공부')
  ]},
  {id:fGTU,type:'folder',name:'기타 URL',icon:'wave',expanded:false,children:[]}
];
var sheetsData=[
  sd(58,'3차 투검위 폴더링'),
  sd(25,'1분과 평가표 및 의견 취합본'),sd(26,'2분과 평가표 및 의견 취합본'),
  sd(70,'(참고) 25년 4차 투검위 결과 안내'),sd(71,'(참고) 25년 5차 투검위 결과 안내'),sd(72,'(참고) 25년 6차 투검위 결과 안내'),
  sd(16,'(립스2)1차 요건검토'),sd(33,'립스1 응답 시트'),sd(37,'립스1 요건검토'),sd(40,'(립스2)2차 요건검토'),sd(57,'3차 요건검토'),
  sd(52,'발표평가 분과구성 자동화'),sd(54,'간사 역평가'),
  sd(29,'26 1차 평가표_1분과'),sd(30,'26 1차 평가표 2분과'),sd(73,'26년 1차 운영양식'),sd(74,'26년 립스2 1차 발표평가 총합'),
  sd(75,'26년 신규운영사 발표 SHEET'),sd(76,'26년 신규운영사 발표평가 참고자료'),sd(77,'26년 1차 모집공고 Q&A 정리'),
  sd(27,'25년 5차 평가표'),sd(61,'3차 발표평가 양식'),
  sd(34,'2026 운영사 추천권 총괄'),sd(56,'2026 운영사 관리 sheet'),sd(78,'26년 립스 운영사 관리시트'),
  sd(35,'2026 소상공인 관리 sheet'),
  sd(15,'26립스 평가위원 섭외',true,true),
  sd(28,'현물 현황'),sd(79,'25년 4차 최종점검 양식'),sd(80,'최종 사업계획서'),sd(81,'정산 및 보고서'),
  sd(31,'메모',true),sd(32,'회의록 주제'),sd(36,'1팀 일정표'),sd(39,'스프레드시트 매니저 DB'),
  sd(53,'☆kaia 사무국'),sd(55,'립스1팀 복기'),sd(59,'분과구성 자동화'),sd(82,'발표평가 SHEET 세팅 공부')
];
var payload={sheetsData:sheetsData,treeData:treeData,nextId:83,currentFilter:'all',currentView:'card',currentSort:'default',searchQuery:'',recentIds:[],recentFolderIds:[],pinnedNodeIds:['t-rec-15'],updatedAt:ts};
localStorage.setItem('sm-data-v1',JSON.stringify(payload));
fetch(GAS,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(JSON.stringify(payload))})
.then(function(r){return r.json();})
.then(function(){alert('복구 완료! (39개 시트, 10개 URL 자동 복구)\n\n새로고침하세요.\n\n아래 시트는 URL을 직접 입력 필요:\n- 투검위/발표평가 관련 평가표 시트들\n- 요건검토 시트들\n- 운영사/소상공인 관리 시트들');})
.catch(function(e){alert('localStorage 복구 완료.\nGAS 동기화 오류: '+e.message+'\n\n새로고침 후 확인하세요.');});
})();
