import { simulateGameLog } from "../src/lib/pbp/engine";
import type { PlayerSimProfile, TeamSimProfile } from "../src/lib/pbp/types";
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
function roster(t:string,s:number):PlayerSimProfile[]{
  const specs:Array<[string,number]>=[["QB",2],["RB",3],["WR",5],["TE",2],["DE",2],["DT",2],["OLB",2],["MLB",2],["CB",3],["S",2],["K",1],["P",1]];
  const out:PlayerSimProfile[]=[];
  for(const [p,c] of specs) for(let i=1;i<=c;i++){const j=((i*7+s)%11)-5;out.push({playerId:`${t}-${p}-${i}`,position:p,overall:clamp(s+j,40,99),depthRank:i,positionSlot:p});}
  return out;
}
const team=(t:string,s:number):TeamSimProfile=>({teamId:t,strength:s,players:roster(t,s)});
let homeWins=0,awayWins=0,ties=0,hs=0,as=0,shutouts=0,n=300;
for(let i=0;i<n;i++){
  const log=simulateGameLog({home:team("home",70),away:team("away",70),seed:1000+i,flavor:"balanced"});
  hs+=log.homeScore; as+=log.awayScore;
  if(log.homeScore>log.awayScore)homeWins++; else if(log.awayScore>log.homeScore)awayWins++; else ties++;
  if(log.homeScore===0||log.awayScore===0)shutouts++;
}

// Control: identical rosters on both sides means any asymmetry is the engine's,
// not the harness's. Verify the two rosters really are identical first.
const a=roster("home",70), b=roster("away",70);
const sameOveralls = a.every((p,i)=>p.overall===b[i].overall && p.position===b[i].position);
console.log(`  rosters identical (overall+position): ${sameOveralls}`);
console.log(`EVEN 70v70 over ${n} seeds:`);
console.log(`  home wins ${homeWins} (${(homeWins/n*100).toFixed(1)}%)  away wins ${awayWins} (${(awayWins/n*100).toFixed(1)}%)  ties ${ties}`);
console.log(`  mean home ${(hs/n).toFixed(1)}  mean away ${(as/n).toFixed(1)}  mean total ${((hs+as)/n).toFixed(1)}`);
console.log(`  games with a shutout: ${shutouts} (${(shutouts/n*100).toFixed(1)}%)`);
