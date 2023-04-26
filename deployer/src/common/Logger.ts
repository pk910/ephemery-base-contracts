
export class Logger {

  public static debug(...message: any[]) {
    console.log.apply(console, arguments);
  }

  public static info(...message: any[]) {
    console.log.apply(console, arguments);
  }

  public static error(...message: any[]) {
    console.log.apply(console, arguments);
  }

}
