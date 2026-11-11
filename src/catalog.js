export const GAMES=[
 {id:'flip',title:'뒤집어 3!',short:'숫자를 뒤집고 3개를 맞춰 점수를 올려요.',genre:'숫자 조합',time:'약 2분',symbol:'3!',color:'violet',modes:['solo','ai','friend']},
 {id:'blind',title:'블라인드 숫자전',short:'1부터 9까지 숫자를 한 번씩 내며 AI의 카드를 이겨요.',genre:'숫자 심리전',time:'약 1분',symbol:'?',color:'amber',modes:['solo','ai','friend']},
 {id:'triad',title:'3장의 법칙',short:'색·모양·개수 각각이 3장 모두 같거나 모두 다른 "세트" 3장을 찾아요.',genre:'관찰·추리',time:'약 2분',symbol:'△',color:'teal',modes:['solo','ai','friend']},
 {id:'trust',title:'믿을까 배신할까',short:'6라운드 동안 상대의 마음을 읽고 협력 또는 배신을 선택하세요.',genre:'심리·전략',time:'약 1분',symbol:'VS',color:'rose',modes:['solo','ai','friend']},
 {id:'baseball',title:'숫자 탐정',short:'숨겨진 세 자리 숫자를 스트라이크·볼 단서로 추리해요.',genre:'숫자 추리',time:'약 2분',symbol:'S·B',color:'green',modes:['solo','ai','friend']},
 {id:'nim',title:'마지막 한 개',short:'돌을 1~3개씩 가져가요. 마지막 돌을 가져가면 패배!',genre:'수학 전략',time:'약 1분',symbol:'●',color:'sky',modes:['solo','ai','friend']},
 {id:'auction',title:'칩 경매',short:'30칩으로 보물 5개를 몰래 입찰해요. 함정 상자는 피하세요!',genre:'입찰 심리전',time:'약 2분',symbol:'₩',color:'coral',modes:['solo','ai','friend']},
 {id:'maze',title:'닿지 마!',short:'구불구불한 길을 벽에 닿지 않고 손가락으로 빠져나가요.',genre:'손 감각',time:'약 1분',symbol:'〰',color:'lime',modes:['solo','ai','friend']},
 {id:'draw',title:'그대로 그리기',short:'하트·씽크칩·동그라미를 한 번에 그려 똑같은 정도를 겨뤄요.',genre:'손 감각',time:'약 1분',symbol:'♥',color:'pink',modes:['solo','ai','friend']},
 {id:'marbles',title:'홀짝 구슬',short:'구슬을 몰래 쥐고, 상대 손 안의 개수가 홀인지 짝인지 맞혀요.',genre:'서바이벌 심리전',time:'약 2분',symbol:'✊',color:'indigo',modes:['solo','ai','friend']},
 {id:'redlight',title:'무궁화 꽃이 피었습니다',short:'누르면 전진! 술래가 돌아보는 순간 손을 떼야 살아남아요.',genre:'서바이벌 반사신경',time:'약 30초',symbol:'👀',color:'red',modes:['solo','ai','friend']},
 {id:'bridge',title:'징검다리 건너기',short:'잠깐 보여준 안전한 돌을 기억해서 끝까지 건너요.',genre:'서바이벌 기억력',time:'약 1분',symbol:'▦',color:'cyan',modes:['solo','ai','friend']},
 {id:'minority',title:'소수결',short:'9명 중 적은 쪽을 고른 사람만 점수! 다른 참가자들의 버릇을 읽어요.',genre:'서바이벌 눈치',time:'약 2분',symbol:'⚖',color:'plum',modes:['solo','ai','friend']},
 {id:'sudoku',title:'스도쿠',short:'9×9 칸에 1~9를 겹치지 않게. 빠르게, 틀리지 않게 풀수록 고득점.',genre:'숫자 퍼즐',time:'약 5분',symbol:'9',color:'sky',modes:['solo','ai','friend']},
 {id:'merge',title:'숫자 합치기',short:'밀어서 같은 숫자를 합쳐요. 정해진 수 안에 최고 점수를!',genre:'숫자 퍼즐',time:'약 3분',symbol:'2⁺',color:'amber',modes:['solo','ai','friend']},
 {id:'stroop',title:'색깔 맞히기',short:'글자를 읽지 말고 색을 보세요. 뇌가 헷갈리는 순발력 테스트!',genre:'순발력',time:'약 30초',symbol:'色',color:'rose',modes:['solo','ai','friend']},
 {id:'gomoku',title:'오목',short:'다섯 개를 먼저 잇는 사람이 승리. AI 또는 친구와 1:1!',genre:'1:1 전략',time:'약 5분',symbol:'●',color:'violet',modes:['solo','ai','friend']},
 {id:'dots',title:'땅따먹기',short:'선을 하나씩 그어 상자를 닫으면 내 땅. 세 번째 선은 조심!',genre:'1:1 전략',time:'약 3분',symbol:'⊞',color:'green',modes:['solo','ai','friend']}
];
export const GAME_BY_ID=Object.fromEntries(GAMES.map(g=>[g.id,g]));
