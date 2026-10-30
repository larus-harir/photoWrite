import type { Project } from './types';
import examples from './examples.json';
export function exampleProject(index = 0): Project {
  const example = examples[index];
  return {
    version: 1, title: example.title, subtitle: ['부제-포도','사랑하고 바라기에 가엾은','부제-우로보로스'][index],
    number: ['005','004','006'][index], showNumber: true, body: example.body,
    year: '2025', location: index===2 ? '대전' : '군산', camera: index===2 ? 'nikon p950' : 'nikon f2', film: index===2 ? '' : 'cinestill 800t-china',
    description: index===2 ? '작품 : 최우람 - 우로보로스' : '', handle:'@cw_b_site', showHandle:true,
    template:'original', photo:example.photo, photoName:`${example.title} · 레퍼런스 사진`, photoWidth:[1147,1008,1164][index], photoHeight:[1434,1258,1455][index],
    crop:{x:.5,y:.5,zoom:1}, gradient:.55, fontSize:36, lineHeight:1.65, margin:64, showTitle:true, textAlign:'top', pageStyles:{}, pageOrder:[],
  };
}
