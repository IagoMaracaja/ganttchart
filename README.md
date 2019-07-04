<div align="center">
    <h2>Gantt Chart</h2>
    <p align="center">
        <p>This library was created using
            <a href="https://frappe.github.io/gantt">
            <b>Frappe Gantt</b>
             </a>javascript lib as base.
         </p>
    </p>
     
</div>

### Install:
```
npm install frappe-gantt
```

### Usage:
Include it in your HTML:
```
<script src="gantt-chart.min.js"></script>
<link rel="stylesheet" href="gantt-chart.css">
```

### Example:
```js
var tasks = [
  {
              name: 'Task Level 1',
              start: '2019-06-01',
              end: '2019-08-10',
              level: 0,
              progress: 10,
              overdue: false,
              taskList: [
                  {
                      start: '2019-06-05',
                      end: '2019-07-01',
                      name: 'Subtask 1',
                      id: 'Task 1',
                      progress: 5,
                      level: 1,
                      overdue: false
                  },
                  {
                      start: '2019-06-01',
                      end: '2019-06-15',
                      name: 'Subtask 2',
                      id: 'Task 2',
                      progress: 100,
                      level: 2,
                      overdue: false
                  },
                  {
                      start: '2019-06-01',
                      end: '2019-06-15',
                      name: 'Subtask 3',
                      id: 'Task 2',
                      progress: 100,
                      level: 3,
                      overdue: false
                  }
              ]
          },
  ...
]
var gantt = new GanttChart("#gantt", tasks);
```

You can also pass various options to the Gantt constructor:
```js
var gantt = new GanttChart("#gantt", tasks, {
    header_height: 50,
    column_width: 30,
    step: 24,
    view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'],
    bar_height: 20,
    bar_corner_radius: 3,
    arrow_curve: 5,
    padding: 18,
    view_mode: 'Day',   
    date_format: 'YYYY-MM-DD',
    custom_popup_html: null
});
```

If you want to contribute:

1. Clone this repo.
2. `cd` into project directory
3. `yarn`
4. `yarn run dev`

License: MIT

------------------
The Original Project is maintained by [frappe](https://github.com/frappe)
