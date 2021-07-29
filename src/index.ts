import "source-map-support/register";
import { Logger } from "tslog";
import * as http from "http";
import express from "express";
import * as fs from "fs";
import { Record, Static, String } from "runtypes";
import faker from "faker";

try {
  fs.mkdirSync("./state");
} catch (e) {
}

const state = JSON.parse((() => {
  try {
    return "" + fs.readFileSync("./state/state.json");
  } catch (e) {
  }
})() || "{}");


const UserDataRuntype = Record({
  name: String,
  surname: String,
  avatar: String,
  birthday: String
});

type UserData = Static<typeof UserDataRuntype>;

setInterval(() => {
  fs.writeFileSync("./state/state.json", JSON.stringify(state));
}, 1000);

const glog = new Logger({
  dateTimePattern: "hour:minute:second.millisecond",
  displayFilePath: "hidden"
  // minLevel: 'debug',
});


async function main() {
  glog.info("starting...");
  glog.info("got config...");

  const app = express();
  const server = http.createServer(app);
  const port = process.env.port || 3021;

  glog.info("binding to http://localhost:" + port);
  server.listen(port);

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(express.text());
  app.use(express.raw());

  app.route("/:username/users")
    .get((req, res) => {
      if (!state.hasOwnProperty(req.params.username)) {
        state[req.params.username] = Array.from({ length: 50 }, (v, i) => ({
          name: faker.name.firstName(),
          surname: faker.name.lastName(),
          avatar: faker.internet.avatar(),
          birthday: faker.date.past()
        })).reduce((acc, el, i) => ({ ...acc, [i + 1]: { ...el, id: i + 1 } }), {});
      }
      const { [req.params.username]: data = {} } = state;
      res.status(200).json({ data: data.filter(x => !x.deleted) });
    })
    .post((req, res) => {
      if (!UserDataRuntype.guard(req.body)) {
        res.status(400).send({ error: "Wrong data" });
        return;
      }
      const new_id: number = (Object.keys(state[req.params.username] || {}).map(x => +x).sort((a, b) => a-b).pop() || 0) + 1;
      state[req.params.username] = {
        ...state[req.params.username],
        [new_id]: req.body
      };
      res.status(200).json({ result: "Created!" });
    });

  app.route("/:username/users/:user_id")
    .get((req, res) => {
      const { [req.params.username]: { [req.params.user_id]: data = {} } } = state;
      res.status(200).json({ data });
    })
    .put((req, res) => {
      if (!UserDataRuntype.guard(req.body)) {
        res.status(400).send({ error: "Wrong data" });
        return;
      }
      if (!state[req.params.username]?.hasOwnProperty(req.params.user_id) || state[req.params.username]?[req.params.user_id]?.deleted) {
        res.status(404).json({ error: "User not found!" });
        return;
      }
      const { [req.params.username]: { [req.params.user_id]: data = {} } } = state;
      state[req.params.username] = {
        ...state[req.params.username],
        [req.params.user_id]: {
          ...state[req.params.username][req.params.user_id],
          ...req.body
        }
      };
      res.status(200).json({ result: "Updated!" });
    })
    .delete((req, res) => {
      if (!state[req.params.username]?.hasOwnProperty(req.params.user_id)) {
        res.status(404).json({ error: "User not found!" });
        return;
      }
      state[req.params.username][req.params.user_id].deleted = true;
      res.status(200).json({ result: "Deleted!" });
      glog.info({ data: req.body });
    });
}

main().catch((e) => glog.error(e));

process.on("SIGINT", function onSigint() {
  console.log("Got SIGINT. Graceful shutdown start", new Date().toISOString());
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});
