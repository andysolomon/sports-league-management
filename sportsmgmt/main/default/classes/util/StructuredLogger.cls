public class StructuredLogger {
    public class LogEntry {
        @AuraEnabled
        public String className;
        @AuraEnabled
        public String methodName;
        @AuraEnabled
        public String message;
        @AuraEnabled
        public String stackTrace;
        @AuraEnabled
        public Datetime timestamp;

        public LogEntry(String className, String methodName, String message, String stackTrace) {
            this.className = className;
            this.methodName = methodName;
            this.message = message;
            this.stackTrace = stackTrace;
            this.timestamp = Datetime.now();
        }
    }

    public static void logError(String className, String methodName, Exception e) {
        LogEntry entry = new LogEntry(className, methodName, e.getMessage(), e.getStackTraceString());
        System.debug(LoggingLevel.ERROR, JSON.serialize(entry));
    }
}
