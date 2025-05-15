/**
 * Log levels in order of verbosity
 */
export enum LogLevel {
	ERROR = 0,
	WARN = 1,
	INFO = 2,
	DEBUG = 3,
}

/**
 * Logger configuration options
 */
export interface LoggerOptions {
	level?: LogLevel;
	includeTimestamps?: boolean;
	prefix?: string;
}

/**
 * A simple logger that adjusts verbosity based on environment
 */
export class Logger {
	private level: LogLevel;
	private includeTimestamps: boolean;
	private prefix: string;
	private static instance: Logger;

	/**
	 * Create a new Logger instance
	 */
	constructor(options: LoggerOptions = {}) {
		const isDevelopment = process.env.NODE_ENV === 'development';

		// In development, default to DEBUG level, in production default to WARN
		this.level = options.level ?? (isDevelopment ? LogLevel.DEBUG : LogLevel.WARN);
		this.includeTimestamps = options.includeTimestamps ?? true;
		this.prefix = options.prefix ?? 'n8n-nodes-firestore';
	}

	/**
	 * Get the singleton logger instance
	 */
	public static getInstance(options?: LoggerOptions): Logger {
		if (!Logger.instance) {
			Logger.instance = new Logger(options);
		}
		return Logger.instance;
	}

	/**
	 * Configure the logger
	 */
	public configure(options: LoggerOptions): void {
		if (options.level !== undefined) {
			this.level = options.level;
		}
		if (options.includeTimestamps !== undefined) {
			this.includeTimestamps = options.includeTimestamps;
		}
		if (options.prefix !== undefined) {
			this.prefix = options.prefix;
		}
	}

	/**
	 * Format a log message
	 */
	private formatMessage(message: string): string {
		const parts = [this.prefix];

		if (this.includeTimestamps) {
			parts.push(new Date().toISOString());
		}

		parts.push(message);
		return parts.join(' | ');
	}

	/**
	 * Log an error message
	 */
	public error(message: string, ...data: unknown[]): void {
		if (this.level >= LogLevel.ERROR) {
			if (data.length > 0) {
				console.error(this.formatMessage(message), ...data);
			} else {
				console.error(this.formatMessage(message));
			}
		}
	}

	/**
	 * Log a warning message
	 */
	public warn(message: string, ...data: unknown[]): void {
		if (this.level >= LogLevel.WARN) {
			if (data.length > 0) {
				console.warn(this.formatMessage(message), ...data);
			} else {
				console.warn(this.formatMessage(message));
			}
		}
	}

	/**
	 * Log an info message
	 */
	public info(message: string, ...data: unknown[]): void {
		if (this.level >= LogLevel.INFO) {
			if (data.length > 0) {
				console.info(this.formatMessage(message), ...data);
			} else {
				console.info(this.formatMessage(message));
			}
		}
	}

	/**
	 * Log a debug message
	 */
	public debug(message: string, ...data: unknown[]): void {
		if (this.level >= LogLevel.DEBUG) {
			if (data.length > 0) {
				console.log(this.formatMessage(message), ...data);
			} else {
				console.log(this.formatMessage(message));
			}
		}
	}

	/**
	 * Check if a certain log level is enabled
	 */
	public isLevelEnabled(level: LogLevel): boolean {
		return this.level >= level;
	}
}

// Export a singleton instance for convenience
export const logger = Logger.getInstance();
