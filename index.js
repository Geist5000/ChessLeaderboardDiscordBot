const Discord = require('discord.js');
require('dotenv').config();
const client = new Discord.Client();
const {ChessRepository} = require("./dbConnection")

const commands = [
    {
        cmds: ["addResult"],
        callback: async function (msg, arguments) {
            const game = await repository.getServer(msg.guild.id);
            if (game !== undefined) {
                if (msg.channel.id === game.scoreboard_channel_id) {
                    if (arguments.length === 2) {
                        let uIds = undefined;
                        try {
                            uIds = arguments.map((a) => {
                                if (a.startsWith("<@") && a.endsWith(">")) {
                                    a = a.slice(2, -1);
                                    if (a.startsWith("!")) {
                                        a = a.slice(1);
                                    }
                                    return a;
                                } else {
                                    throw "No valid user Mention!";
                                }
                            });
                        } catch (err) {
                            msg.channel.send("No valid Users");
                            return;
                        }
                        repository.addResult(game.server_id, uIds[0], uIds[1], false);
                        await updateScoreboardMessage(game,msg.channel);
                        msg.delete();
                    } else {
                        msg.channel.send("Please use the command in a proper way! " + process.env.PREFIX + "addResult [menition of Winner] [mention of Looser]");
                    }
                }
            } else {
                msg.channel.send("No Leaderboard, create one with" + process.env.PREFIX + "startChess");
            }
        }
    },
    {
        cmds: ["startChess"],
        callback: async function (msg, arguments) {
            const game = await repository.getServer(msg.guild.id);
            if (game === undefined) {
                if (arguments.length === 0) {
                    let scoreMessage = await msg.channel.send(await getScoreBoardMessageEmbed(msg.guild.id));

                    msg.delete();
                    await repository.insertGame(msg.guild.id, msg.channel.id, scoreMessage.id);

                } else {
                    msg.channel.send("Wrong arguments!");
                }
            } else {
                msg.channel.send("There is already a Leaderboard!");
            }
        }
    }
];


function handleCommand(msg, command) {
    const splitted = command.split(/ +/);
    const cmd = commands.find(
        (c) => c.cmds.some(
            (cmd) => cmd.toLowerCase() === splitted[0].toLowerCase()));
    if (cmd !== undefined) {
        cmd.callback(msg, splitted.slice(1));
    }
}


const repository = new ChessRepository(process.env.DB_HOST, process.env.DB_USER, process.env.DB_PASS, process.env.DB_NAME)

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});


client.on('message', msg => {
    if (msg.author.id !== client.user.id) {
        console.log(msg.content);
        if (msg.content.startsWith(process.env.PREFIX)) {
            handleCommand(msg, msg.content.slice(1));
        }
    }

});

client.login(process.env.token);


async function updateScoreboardMessage(game,channel){
    const message = await channel.messages.fetch(game.scoreboard_message_id);
    message.edit(await getScoreBoardMessageEmbed(game.server_id));
}

/**
 * everything which stays static
 */
async function getScoreBoardMessageEmbed(server_id) {
    const desc = await getScoreboardDescription(server_id);
    return new Discord.MessageEmbed().setTitle("Scoreboard").setTimestamp().setColor("#0033cc").setDescription(desc);
}

async function getScoreboardDescription(server_id) {
    const scores = await repository.getScoresOfServer(server_id);
    let prevScore = -1;
    let prevIndex = -1;
    let index = 1;
    const rows = scores.map((s) => {
        let row = "";
        if (s.score === prevScore) {
            row = prevIndex.toString();
        } else {
            row = index.toString();
            prevIndex = index;
        }
        row += ".   \t<@" + s.user_id + ">   (" + s.score + ")";
        prevScore = s.score;
        index++;
        return row;
    });
    return rows.join("\n");
}
