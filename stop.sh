screen -ls | grep Schachi | cut -d. -f1 | awk '{print $1}' | xargs kill
