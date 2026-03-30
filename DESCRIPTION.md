I have a mobile app that I want to create, and I want you to design the tech stack for it. The app will only ever need to run on Android phones. The idea is to create an app that lets me input my meetings and it will sync it with my Google Calendar as well as schedule an alarm five minutes before the meeting. This is to make it easier for me to remember when meetings happen and so I am not always wondering.



The way the app should work is:The main page should be a list of all of my current meetings with a plus button in the bottom right to add a new meeting.

That should just display a quick pop-up modal that asks for the name, description, date and time, and maybe a few checkboxes for scheduling other alarms. By default, it should schedule an alarm for 10 minutes before, but there should also be options for 30 minutes and 1 hour before. They should all be checkboxes for what alarms are going to happen.

Upon adding it, it will then get displayed on that main homepage, and it should just be a list of all the upcoming meetings sorted.

There should be a second button on top of it that allows you to import meetings from your Google Calendar. The way that should work is you press it and a modal pops up which will display all of your upcoming Google Calendar events in a list sorted by time. Upon clicking an event, it will get expanded beneath it to display the checkboxes for what time you want to schedule an alarm and then an add button. This way you can just click on events, select what times you want them, and then press add, and you can do 5 events at once without having to navigate through extra menus.

Then you can close that menu and it'll all be visible on the home screen.

There should be a hamburger menu on the top left side of the screen that will contain a settings page that will let you configure all of the different alarm options.

You should be able to provide a list of durations that should be visible when you schedule a meeting, and those durations would be those alarms, so you can schedule durations in terms of minutes or hours.



There should also be a delete button for meetings so you can remove them from the home page. As well as an edit button to change anything about them as needed. For the Google Calendar integration that should be on the settings page, it's just a simple login button. If you ever schedule a meeting or try to import and it can't connect to Google Calendar, you should get a little in-app pop-up notification that will let you know that the meeting was not able to be scheduled. It is kind of like a fail-safe in case you get signed out or if your token expires, so you are aware that your Google Calendar is no longer synced. This app should also have notifications, and again, that should be part of the settings page to configure anything related to the notification system, mainly for what time periods should notifications get sent. In that little options menu where you're able to specify, here are the different durations that should be available when I want to schedule alarms. There should also be a checkbox for each of those durations that should let you select whether or not you also want to receive a notification at those.



What it should look like is just a list of all the different time options, and then beneath it should be just a text box with a button to the right of it. The text box is going to be for the duration, so you would just specify:3 minutes

15 minutes

30 minutes

1 hour

2 hours



You will input that box in minutes, but visually it'll be displayed as hours to make it nicer. If it rounds to an even number of hours, it will be displayed as hours with rollover. For example:If I put in 30, it would say 30 minutes.

If I put in 60, it would say 1 hour.

If I put in 90, it would say 1 hour and 30 minutes.

If I put in 120, it would say 2 hours.



After you press the Add button, that new time will get added to that list. There should be a trash can icon to delete that notification time option, and there should also be a checkbox to say whether or not it is a notification. By default, they're always alarms, but the checkbox is "Do you also want a notification to come with that alarm?" so you should get a notification and then the alarm happens.



Can you also make another setting option for notification offset? This should basically say that notifications come 5 minutes before they're scheduled. If the notification should come at 1:30, I want it to come at 1:25. This is just so that I can get an earlier warning, like maybe I don't want the alarm to happen, so I can see the notification and then quickly go and disable the alarm. 



As a part of the hamburger menu, there should also be a timers option. This will just show you all of the upcoming timers and what events they are registered to. There should be a dismiss button that will let you disable the alarm. It should not delete it; it should just gray it out in the UI and add an enable button onto it. That way I can kind of disable upcoming alarms as needed, but I can also re-enable them. As soon as an event has been in the past, it should be removed and all of its alarms should also be removed.



Can you also have that as a settings option, an option to say how far in the past does an event have to have ended before it gets removed? By default, I want that to be one hour, so one hour after the end time the event should be removed along with all of its alarms. Again, on this alarm page, it should show the time that the alarm is scheduled at, with the date underneath it, and then to the right it should display just some basic info about the event it is registered for. Can you also color code all of these events to make it easier to see? Use a linearly repeating color scheme and don't use just the regular rainbows that might make colors look too similar next to each other. Find a pattern of, say, 8 to 10 colors that are all different enough from each other. Don't pick any blacks, browns, or grays. Have it be proper, vibrant colors. For example, it could be:red

blue

yellow

green

purple



again, just to differentiate them that way. When I'm looking at the timers page, I will also see all of the meetings color coded, so it'll be easier for me to see what alarms go to what meetings. Especially if I have meetings very close to each other, there might be situations where there's an alarm for one meeting and then an alarm for a different meeting and then an alarm back for the same meeting.



Make sure that these colors are subtle. It should just be a slight border, maybe tint the background a little bit towards that color. These colors should also be pastel colors, so they shouldn't be super vibrant in your face; they should be somewhat muted and kind of more of an undertone. 



Talking about the alarm system itself, it should function almost exactly like the default Android alarm system. When the alarm is set to be scheduled, it should have a full-screen overlay that displays the current time, the meeting title and description, and it should have buttons to add 1 min, 5 min, and 10 min to the alarm. It basically acts like a snooze function where all of the metadata of the alarm will stay the same. It will just be rescheduled at that new time, rescheduled 1 min ahead, 5 min ahead, or 10 min ahead. There will be a big button at the bottom to stop the alarm. Make sure that in the settings page as well, the user can customize the alarm sound. They should be able to select a file from their local file system as the alarm sound that they want to have displayed. Can you also make it so that when the alarm goes off, it will also vibrate the phone? 



And then again on the settings page, can you make it have its own volume and vibration sliders with test buttons so you can customize how loud you want the alarm sounds to be? Can you also make sure that this alarm system is using the system alarm volume slider in addition to its own slider? This is just because the users that will be using this will most likely have their media volume set to none. Make sure that this app will properly use the alarm volume option in order to make sure that the alarm will actually sound.