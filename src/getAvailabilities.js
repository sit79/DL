import moment from "moment";
import knex from "knexClient";

export default async function getAvailabilities(date, numberOfDays = 7) {
  const availabilities = new Map();
  for (let i = 0; i < numberOfDays; ++i) {
    const tmpDate = moment(date).add(i, "days");
    availabilities.set(tmpDate.format("dYYYYMMDD"), {
      date: tmpDate.toDate(),
      slots: []
    });
  }

  // lookAhead provides the proper maximum extent of the date range
  const lookAhead = +date + numberOfDays * 86400000 - 1;

  // retrieve all events relevant to the given time period
  const events = await knex
    .select("kind", "starts_at", "ends_at", "weekly_recurring")
    .from("events")
    .where(function() {
      this.where("weekly_recurring", true).andWhere(
        "starts_at",
        "<=",
        lookAhead
      );
    })
    .orWhere(function() {
      this.where("kind", "appointment")
        .andWhere("ends_at", "<", lookAhead)
        .andWhere("starts_at", ">=", +date);
    })
    .orWhere(function() {
      this.where("kind", "opening")
        .andWhere("weekly_recurring", false)
        .andWhere("ends_at", "<", lookAhead)
        .andWhere("starts_at", ">=", +date);
    });

  // first insert all available openings
  availabilities.forEach(day => {
    for (const event of events) {
      if (event.kind === "opening") {
        if (event.weekly_recurring) {
          if (
            moment(event.starts_at).format("d") === moment(day.date).format("d")
          ) {
            for (
              let date = moment(event.starts_at);
              date.isBefore(event.ends_at);
              date.add(30, "minutes")
            ) {
              day.slots.push(date.format("H:mm"));
            }
          }
        } else {
          if (
            moment(event.starts_at).format("dYYYYMMDD") ===
            moment(day.date).format("dYYYYMMDD")
          ) {
            for (
              let date = moment(event.starts_at);
              date.isBefore(event.ends_at);
              date.add(30, "minutes")
            ) {
              day.slots.push(date.format("H:mm"));
            }
          }
        }
      }
    }
  });

  // then remove the slots from availabilities which have appointments
  availabilities.forEach(day => {
    for (const event of events) {
      if (event.kind === "appointment") {
        if (
          moment(event.starts_at).format("dYYYYMMDD") ===
          moment(day.date).format("dYYYYMMDD")
        ) {
          for (
            let date = moment(event.starts_at);
            date.isBefore(event.ends_at);
            date.add(30, "minutes")
          ) {
            day.slots = day.slots.filter(
              slot => slot.indexOf(date.format("H:mm")) === -1
            );
          }
        }
      }
    }
  });

  const result = Array.from(availabilities.values());
  return result;
}
