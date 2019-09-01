import moment from "moment";
import knex from "knexClient";

export default async function getAvailabilities(date, numberOfDays = 7) {
  const availabilities = new Map();
  for (let i = 0; i < 7; ++i) {
    const tmpDate = moment(date).add(i, "days");
    availabilities.set(tmpDate.format("d"), {
      date: tmpDate.toDate(),
      slots: []
    });
  }

  const lookAhead = numberOfDays * 86400000;

  const events = await knex
    .select("kind", "starts_at", "ends_at", "weekly_recurring")
    .from("events")
    .where(function() {
      this.where("weekly_recurring", true).andWhere(
        "starts_at",
        "<=",
        +date + lookAhead
      );
    })
    .orWhere(function() {
      this.where("kind", "appointment")
        .andWhere("starts_at", "<=", +date + lookAhead)
        .andWhere("starts_at", ">", +date);
    });

  for (const event of events) {
    for (
      let date = moment(event.starts_at);
      date.isBefore(event.ends_at);
      date.add(30, "minutes")
    ) {
      const day = availabilities.get(date.format("d"));
      if (event.kind === "opening") {
        day.slots.push(date.format("H:mm"));
      } else if (event.kind === "appointment") {
        day.slots = day.slots.filter(
          slot => slot.indexOf(date.format("H:mm")) === -1
        );
      }
    }
  }

  return Array.from(availabilities.values());
}
