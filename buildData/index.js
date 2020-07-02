const hex64 = require('hex64'),
    buildsInfo = require('./buildsInfo.json'),
    axios = require('axios');

Object.defineProperty(Array.prototype, 'chunk', {
    value: function (chunkSize) {
        const temporal = [];

        for (let i = 0; i < this.length; i += chunkSize) {
            temporal.push(this.slice(i, i + chunkSize));
        }

        return temporal;
    }
});


class buildTemplateParser {
    constructor(bt) {
        this.template = bt;
        // this.buildHex = this.hexBytes;
        this.build = {//blank build 
            prof: null,
            specs: [null, null, null],
            skills: {
                skillList: [],
                skillPalete: [],
                land: [[], []],
                water: [[], []]
            }
        }
    }
    get hexBytes() {
        return hex64.toHex(this.template.slice(2, -1)).match(/\w{2}/g);
    }
    async parsedTemplate() {
        let bhgTemp = this.hexBytes.slice(1);
        this.build.prof = buildsInfo.profs[parseInt(bhgTemp.shift())];
        this.build.template = this.template;
        let specBit, traitBit, whichSpec, usedTraits, skillId, allTraits = [];
        // loop thru each specialization slot
        for (let i = 0; i < 3; i++) {
            specBit = parseInt(bhgTemp.shift(), 16);//the specialization ID byte
            traitBit = parseInt(bhgTemp.shift(), 16).toString(2);//picked trait bytes
            while (traitBit.length < 6) {
                traitBit = '0' + traitBit;//leftpad traitBit
            }
            traitBit = traitBit.match(/\w{2}/g).reverse().map(q => parseInt(q, 2) - 1);//chunk the traits, and reverse 
            whichSpec = buildsInfo.specializations.find(q => q.id == specBit);//find our specialization
            console.log(whichSpec)
            usedTraits = whichSpec.major_traits.chunk(3);
            // console.log('TRAIT NUMBER',i,'ALL MINOR',whichSpec.minor_traits,'THIS ONE',whichSpec.minor_traits[i])
            this.build.specs[i] = {
                spec: {
                    //info about the specialization itself
                    name: whichSpec.name,
                    bg: whichSpec.background,
                    id: specBit,
                    icon: whichSpec.icon,//specialization icon,
                    elite:!!whichSpec.elite
                },
                traitSlots: whichSpec.major_traits.chunk(3).map((q, n) => ({
                    minor: whichSpec.minor_traits[n],
                    major: q
                })),
                usedTraits: traitBit.map((q, n) => usedTraits[n][q])
            }
            allTraits.push(...whichSpec.major_traits, ...whichSpec.minor_traits)
        }
        const traitInfo = await axios.get('https://api.guildwars2.com/v2/traits?ids=' + allTraits.join(','));
        //Convert traits/specs to a FE-readable format
        this.build.specs.forEach(spc => {
            spc.traitSlots.forEach((traitSlot, n) => {
                for (let i = 0; i < 3; i++) {
                    const majTrait = traitInfo.data.find(q => q.id == traitSlot.major[i]);
                    traitSlot.major[i] = {
                        name: majTrait.name,
                        id: majTrait.id,
                        order: majTrait.order,
                        icon: majTrait.icon,
                        desc: majTrait.description.replace(/<[=@\w]+>/g, '').replace(/<\/\w+>/g, ''),
                        picked: spc.usedTraits.includes(traitSlot.major[i])
                    }
                }
                const minTrait = traitInfo.data.find(q => q.id == traitSlot.minor);
                traitSlot.minor = {
                    name: minTrait.name,
                    id: minTrait.id,
                    icon: minTrait.icon,
                    desc: minTrait.description.replace(/<[=@\w]+>/g, '').replace(/<\/\w+>/g, '')
                };
            })
        })

        //Skill template codes (may be invalid if Rev; we'll fix that later!)
        let bitA, bitB, bothBits;
        for (let i = 0; i < 10; i++) {
            bitA = bhgTemp.shift();
            bitB = bhgTemp.shift();
            bothBits = parseInt(bitA, 16) < parseInt(bitB, 16) ? bitA + bitB : bitB + bitA;
            if (this.build.prof == 'Revenant') {
                continue;
            }
            skillId = buildsInfo.skills.find(q => q.palId == parseInt(bothBits, 16));
            if (skillId && skillId.skillId) {
                skillId = skillId.skillId;
            }
            if (!!skillId) {
                if (!(i % 2)) {
                    this.build.skills.land[0].push(skillId)
                } else {
                    this.build.skills.water[0].push(skillId)
                }
            }
            console.log(`Lookin for bothbits ${bothBits} parsed palette id is ${parseInt(bothBits,16)}, skillID probly ${skillId}`)
            this.build.skills.skillList.push(skillId)
            this.build.skills.skillPalete.push(parseInt(bothBits, 16))
        }

        //Pets or legend (ranger/rev), or just continue on (everyone else)
        if (this.build.prof == 'Ranger') {
            //RANGER: PETS
            //first, set up our pet um... dog house. Whatever
            this.build.pets = {
                land: [{
                    id: null
                }, {
                    id: null
                }],
                water: [{
                    id: null
                }, {
                    id: null
                }]
            }
            const petIdList = bhgTemp.splice(0, 4).map(q => parseInt(q, 16));
            this.build.pets.land[0].id = petIdList[0];
            this.build.pets.land[1].id = petIdList[1];
            this.build.pets.water[0].id = petIdList[2];
            this.build.pets.water[1].id = petIdList[3];
            const petInfo = await axios.get('https://api.guildwars2.com/v2/pets?ids=' + petIdList.join(','));
            this.build.pets.land[0] = petInfo.data.find(p => p.id == this.build.pets.land[0].id);
            this.build.pets.land[1] = petInfo.data.find(p => p.id == this.build.pets.land[1].id);
            this.build.pets.water[0] = petInfo.data.find(p => p.id == this.build.pets.water[0].id);
            this.build.pets.water[1] = petInfo.data.find(p => p.id == this.build.pets.water[1].id);
        } else if (this.build.prof == 'Revenant') {
            //REV: LEGENDS
            console.log('Rev! Remaining data for legends are', bhgTemp)
            this.build.legs = {
                land: [{
                    id: null,
                },
                {
                    id: null,
                }],
                water: [{
                    id: null,
                },
                {
                    id: null,
                }]
            }
            //blank the skills lists (we're gonna refill em)
            this.build.skills.land = [[], []];
            this.build.skills.water = [[], []];
            this.build.skills.skillList = [];

            //set the actual legends
            const legIdList = bhgTemp.splice(0, 4).map(q => parseInt(q, 16));
            this.build.legs.land[0] = legIdList[0] ? buildsInfo.revLegs[legIdList[0] - 13] : null;
            this.build.legs.land[1] = legIdList[1] ? buildsInfo.revLegs[legIdList[1] - 13] : null;
            this.build.legs.water[0] = legIdList[2] ? buildsInfo.revLegs[legIdList[2] - 13] : null;
            this.build.legs.water[1] = legIdList[3] ? buildsInfo.revLegs[legIdList[3] - 13] : null;

            //now we got all the actual leg human-readable data. Next: set the skills
            const legendNums = legIdList.map(q => q ? `Legend${q - 12}` : null)
            const legApi = await axios.get('https://api.guildwars2.com/v2/legends?ids=' + legendNums.filter(q => !!q).join(','));
            console.log('LEGAPI', legApi.data, 'LEG NUMS', legendNums)
            legApi.data.forEach(d => {
                let targArr = null,
                    n = legendNums.indexOf(d.id),
                    low = null;
                arrNum = n;
                if (n < 2) {
                    low = 'land';
                    targArr = this.build.skills.land;
                } else {
                    low = 'water';
                    arrNum -= 2;
                    targArr = this.build.skills.water;
                }
                console.log('placing traits for leg number', arrNum, 'in', low)
                targArr[arrNum] = [d.heal, d.utilities[0], d.utilities[1], d.utilities[2], d.elite]
                this.build.skills.skillList.push(d.heal, d.utilities[0], d.utilities[1], d.utilities[2], d.elite)
            })
            this.build.skills.skillList = _.uniq(this.build.skills.skillList);//
        } else {
            //ALL OTHERS
        }


        //got skill IDs; get the actual skill info from API
        // console.log('Getting skills',this.build.skills.skillList)

        const skillsFromAPI = await axios.get('https://api.guildwars2.com/v2/skills?ids=' + this.build.skills.skillList.join(','));
        this.build.skills.water[0] = this.build.skills.water[0].map(n => skillsFromAPI.data.find(q => q.id == n));
        this.build.skills.land[0] = this.build.skills.land[0].map(n => skillsFromAPI.data.find(q => q.id == n));
        if (!!this.build.skills.water[1]) {
            this.build.skills.water[1] = this.build.skills.water[1].map(n => skillsFromAPI.data.find(q => q.id == n));
        }
        if (!!this.build.skills.water[1]) {
            this.build.skills.land[1] = this.build.skills.land[1].map(n => skillsFromAPI.data.find(q => q.id == n));
        }
        return this.build
    }
}

module.exports = buildTemplateParser;

