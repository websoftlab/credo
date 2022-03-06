// definition http://translate.sourceforge.net/wiki/l10n/pluralforms

let sets = [
	{ lang: ['ach','ak','am','arn','br','fil','gun','ln','mfe','mg','mi','oc','pt','pt-BR','tg','tl','ti','tr','uz',
			'wa'], fc: 1 },

	{ lang: ['af','an','ast','az','bg','bn','ca','da','de','dev','el','en','eo','es','et','eu','fi','fo','fur','fy',
			'gl','gu','ha','hi','hu','hy','ia','it','kk','kn','ku','lb','mai','ml','mn','mr','nah','nap','nb','ne','nl',
			'nn','no','nso','pa','pap','pms','ps','pt-PT','rm','sco','se','si','so','son','sq','sv','sw','ta','te','tk',
			'ur','yo'], fc: 2 },

	{ lang: ['ay','bo','cgg','fa','ht','id','ja','jbo','ka','km','ko','ky','lo','ms','sah','su','th','tt','ug','vi',
			'wo','zh'], fc: 3 },

	{ lang: ['be','bs', 'cnr', 'dz','hr','ru','sr','uk'], fc: 4 },
	{ lang: ['ar'], fc: 5 },
	{ lang: ['cs','sk'], fc: 6 },
	{ lang: ['csb','pl'], fc: 7 },
	{ lang: ['cy'], fc: 8 },
	{ lang: ['fr'], fc: 9 },
	{ lang: ['ga'], fc: 10 },
	{ lang: ['gd'], fc: 11 },
	{ lang: ['is'], fc: 12 },
	{ lang: ['jv'], fc: 13 },
	{ lang: ['kw'], fc: 14 },
	{ lang: ['lt'], fc: 15 },
	{ lang: ['lv'], fc: 16 },
	{ lang: ['mk'], fc: 17 },
	{ lang: ['mnk'], fc: 18 },
	{ lang: ['mt'], fc: 19 },
	{ lang: ['or'], fc: 2 },
	{ lang: ['ro'], fc: 20 },
	{ lang: ['sl'], fc: 21 },
	{ lang: ['he','iw'], fc: 22 },
];

const rules: {
	[key: number]: (n: number) => number;
} = {
	1:  (n) => { return Number(n > 1); },
	2:  (n) => { return Number(n != 1); },
	3:  () => { return 0; },
	4:  (n) => { return Number(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2); },
	5:  (n) => { return Number(n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5); },
	6:  (n) => { return Number((n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2); },
	7:  (n) => { return Number(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2); },
	8:  (n) => { return Number((n==1) ? 0 : (n==2) ? 1 : (n != 8 && n != 11) ? 2 : 3); },
	9:  (n) => { return Number(n >= 2); },
	10: (n) => { return Number(n==1 ? 0 : n==2 ? 1 : n<7 ? 2 : n<11 ? 3 : 4) ;},
	11: (n) => { return Number((n==1 || n==11) ? 0 : (n==2 || n==12) ? 1 : (n > 2 && n < 20) ? 2 : 3); },
	12: (n) => { return Number(n%10!=1 || n%100==11); },
	13: (n) => { return Number(n !== 0); },
	14: (n) => { return Number((n==1) ? 0 : (n==2) ? 1 : (n == 3) ? 2 : 3); },
	15: (n) => { return Number(n%10==1 && n%100!=11 ? 0 : n%10>=2 && (n%100<10 || n%100>=20) ? 1 : 2); },
	16: (n) => { return Number(n%10==1 && n%100!=11 ? 0 : n !== 0 ? 1 : 2); },
	17: (n) => { return Number(n==1 || n%10==1 && n%100!=11 ? 0 : 1); },
	18: (n) => { return Number(n==0 ? 0 : n==1 ? 1 : 2); },
	19: (n) => { return Number(n==1 ? 0 : n==0 || ( n%100>1 && n%100<11) ? 1 : (n%100>10 && n%100<20 ) ? 2 : 3); },
	20: (n) => { return Number(n==1 ? 0 : (n==0 || (n%100 > 0 && n%100 < 20)) ? 1 : 2); },
	21: (n) => { return Number(n%100==1 ? 1 : n%100==2 ? 2 : n%100==3 || n%100==4 ? 3 : 0); },
	22: (n) => { return Number(n==1 ? 0 : n==2 ? 1 : (n<0 || n>10) && n%10==0 ? 2 : 3); },
};

const plurals: {
	[key: string]: (n: number) => number;
} = {};

sets.forEach(item => {
	const rule = rules[item.fc];
	item.lang.forEach(lang => {
		plurals[lang] = rule;
	})
});

export default plurals;
