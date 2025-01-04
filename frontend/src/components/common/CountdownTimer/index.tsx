import moment from "moment";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { now } from "../../../utils/runtimeConfig";

const calculateDuration = (eventTime: number) =>
  moment.duration(
    Math.max(eventTime - Math.floor(now() / 1000), 0),
    "seconds"
  );

export function Countdown({
  eventTime,
  interval = 1000,
  onFinish,
}: {
  eventTime: number;
  interval?: number;
  onFinish?: () => void | Promise<void>;
}) {
  const [duration, setDuration] = useState(calculateDuration(eventTime));
  const timerRef = useRef(0);
  let isOnFinishFired = false;
  const timerCallback = useCallback(async () => {
    setDuration(calculateDuration(eventTime));
    if (!isOnFinishFired) {
      if (onFinish && eventTime * 1000 <= now()) {
        isOnFinishFired = true;
        await onFinish();
      }
    }
  }, [eventTime]);

  useEffect(() => {
    timerRef.current = window.setInterval(timerCallback, interval);

    return () => {
      clearInterval(timerRef.current);
    };
  }, [eventTime]);

  return (
    <div className="font-bold text-sm">
      {duration.days()} Days {duration.hours()} Hrs {duration.minutes()} Mins{" "}
      {duration.seconds()} Secs
    </div>
  );
}
