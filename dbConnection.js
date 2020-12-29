const mysql = require('mysql');

const defaultErrorHandler = function (cb) {
    return (err) => {
        if (err) throw err;
        if (cb) cb();
    }
}


class ChessRepository {

    cachedGames = undefined;


    constructor(host, user, password, database) {
        this.serversDirty = false;
        this.con = mysql.createConnection({
            host: host,
            user: user,
            password: password,
            database: database
        });

        this.con.connect((err) => {
            if (err) throw err;
            this.#createTables();
        })
    }

    #createTables() {
        this.con.query("CREATE TABLE IF NOT EXISTS `chess_data`.`games` (\n" +
            "  `server_id` CHAR(24) NOT NULL,\n" +
            "  `scoreboard_channel_id` CHAR(24) NOT NULL,\n" +
            "  `scoreboard_message_id` CHAR(24) NOT NULL,\n" +
            "  PRIMARY KEY (`server_id`))\n" +
            "ENGINE = InnoDB;"
            , defaultErrorHandler(() => {

                this.con.query("CREATE TABLE IF NOT EXISTS `chess_data`.`scores` (\n" +
                    "  `id` INT NOT NULL AUTO_INCREMENT,\n" +
                    "  `game_id` CHAR(24) NOT NULL,\n" +
                    "  `winner_id` CHAR(24) NOT NULL,\n" +
                    "  `loser_id` CHAR(24) NULL,\n" +
                    "  `remis` TINYINT NOT NULL,\n" +
                    "  `date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n" +
                    "  PRIMARY KEY (`id`),\n" +
                    "  CONSTRAINT `foreign_key_games`\n" +
                    "    FOREIGN KEY (`game_id`)\n" +
                    "    REFERENCES `chess_data`.`games` (`server_id`)\n" +
                    "    ON DELETE CASCADE\n" +
                    "    ON UPDATE CASCADE)\n" +
                    "ENGINE = InnoDB",
                    defaultErrorHandler(() => {
                        this.con.query("CREATE  OR REPLACE VIEW `scores_view` AS SELECT game_id,winner_id as user_id,sum(CASE WHEN `remis`=0 THEN 3 ELSE 1 END) as score FROM `scores` GROUP BY `winner_id`,`game_id`;",
                            defaultErrorHandler(() => console.log("Tables created!")));
                    }))
            }));
    }

    fetchGames(forceNew) {
        forceNew = forceNew || this.serversDirty;
        console.log("dirty " +this.serversDirty);
        return new Promise((resolve, reject) => {
            if (this.cachedGames === undefined || forceNew) {
                this.querryAsPromise("SELECT * FROM `games`;",undefined).then((result)=>{
                    this.cachedGames = result.map((r) => r);
                    resolve(this.cachedGames);
                }).catch((err)=>reject(err));
            } else {
                resolve(this.cachedGames);
            }
        });
    }
    async getServer(serverId) {
        const games = await this.fetchGames();
        return games.find((g) => g.server_id === serverId);

    }


    insertGame(server_id, channel_id, message_id) {
        return this.querryAsPromise("INSERT INTO `games` VALUES (?,?,?);", [server_id, channel_id, message_id]).then((result) =>{
            this.serversDirty = true;
            console.log("Insert successful")
        }).catch(defaultErrorHandler());
    }

    addResult(gameId, winnerId, loserId, remis) {
        const query = "INSERT INTO `scores` (game_id,winner_id,loser_id,remis)VALUES (?,?,?,?);";
        if(!remis)
            this.querryAsPromise(query,[gameId,winnerId,loserId,remis]).catch(defaultErrorHandler());
        else
            this.querryAsPromise(query,[[gameId,winnerId,null,remis],[gameId,loserId,null,remis]]).catch(defaultErrorHandler());
    }

    getScoresOfServer(serverId){
        return this.querryAsPromise("SELECT user_id,score FROM `scores_view` WHERE game_id=? ORDER BY `score` DESC;",[serverId])
    }



    querryAsPromise(querry, values) {
        return new Promise((resolve, reject) => {
            this.con.query(querry, values, (err, result, fields) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            )
        });
    }

    close() {
        this.con.close();
    }
}


module.exports = {
    ChessRepository
}



