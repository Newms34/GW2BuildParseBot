const Discord = require('discord.js'),
    dsClient = new Discord.Client(),
    fs = require('fs'),
    BuildTemplater = require('./buildData'),
    keys = fs.existsSync('config.json') ? JSON.parse(fs.readFileSync('config.json', 'utf-8')) : {
        apiKey: process.env.APIKEY
    };
// app.use(compression());

dsClient.commands = new Discord.Collection();
dsClient.genBuildMsgs = function (data) {
    // console.log('attempting to generate message from',data,user)
    const embeds = [];

    //first, prof with optional elite spec
    const possElite = data.specs.find(q => !!q.spec.elite);
    embeds.push(new Discord.MessageEmbed()
        .setColor('#555555')
        .setTitle(data.prof)
        .setDescription(!!possElite ? possElite.spec.name : '(Core)')
        .addField('\u200b',data.template)
        .setThumbnail(!!possElite ? possElite.spec.icon : '')
    );

    //next, each specialization:

    data.specs.forEach((sp, i) => {
        embeds.push(new Discord.MessageEmbed()
            .setColor('#555555')
            .setTitle(sp.spec.name)
            .setThumbnail(sp.spec.icon)
            .addFields(...sp.traitSlots.map((ts, n) => {
                const pickedTrait = ts.major.find(q => !!sp.usedTraits.includes(q.id));
                // console.log('PICKED TRAIT', pickedTrait)
                return {
                    name: pickedTrait.order + 1,
                    value: `${!!n ? '| ' : ' '}${pickedTrait.name}`,
                    inline: true,
                };
            }))
        )
    })

    //skills for everyone but rev
    if(data.prof!='Revenant'){

        const erfEmbed = new Discord.MessageEmbed();
        erfEmbed.setColor('#425c3d');
        erfEmbed.setTitle('Terrestrial Skills');
        data.skills.land[0].forEach(sk => {
            erfEmbed.addField('\u200b',`__*${sk.name}*__\n${sk.description}`)
        })
        embeds.push(erfEmbed)
        
        const waterEmbed = new Discord.MessageEmbed();
        waterEmbed.setColor('#505d8f');
        waterEmbed.setTitle('Aquatic Skills');
        data.skills.water[0].forEach(sk => {
            waterEmbed.addField('\u200b',`__*${sk.name}*__\n${sk.description}\n`)
        })
        embeds.push(waterEmbed);
    }
    return embeds;
}
dsClient.once('ready', function () {
    console.log('Discord server started. Starting main server!')
})

function getNameFromMention(mention) {
    if (!mention) return;
    if (mention.startsWith('!')) {
        mention = mention.slice(1);
    }
    // console.log('final mention code is', mention,'Users cache is',dsClient.users)
    return dsClient.users.cache.get(mention).username;

}

const tempFn = data => {
    console.log('PROF', data.prof, 'SPECS', data.specs.map(q => q.spec.name))
    let embed1 = new Discord.MessageEmbed({
        title: 'prof stuff',
        description: 'about the prof',
    });

    let embed2 = new Discord.MessageEmbed({
        title: 'spec stuff',
        description: 'about the specializations',
    });
    return [embed1, embed2]
}

dsClient.on('message', async function (message) {
    const possBuild = message.content.match(/\[&D[\w+=]{5,}]/);
    if (!possBuild) {
        //no build: exit
        return false;
    }

    const tmplt = await new BuildTemplater(possBuild[0]).parsedTemplate();
    const wh = await message.channel.createWebhook('GW2 Build Parser Bot', message.author.displayAvatarURL);
    wh.send({ embeds: dsClient.genBuildMsgs(tmplt) }).then(rw => {
        wh.delete()
    })
    // console.log(message.guild.me)
})
dsClient.login(keys.apiKey);

async function testBuild() {
    const myTemp = "[&DQMGPh0aKx8oARQBrhKGAA4TXwFfAQEB+RKJAQAAAAAAAAAAAAAAAAAAAAA=]";
    const tmplt = await new BuildTemplater(myTemp).parsedTemplate();
    console.log('tmplt was', tmplt)
}

// testBuild()
