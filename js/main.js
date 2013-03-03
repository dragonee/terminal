function display(result) {
    if (typeof result === 'string') {
        this.echo(result);
    } else if (result instanceof Array) {
        this.echo(result.join(' '));
    } else if (typeof result === 'object') {
        for (var f in result) {
            if (!result.hasOwnProperty(f)) {
                continue
            }

            this.echo(f + ': ' + result[f]);
        }
    }
}

function call_rpc(url, id, method, params, terminal, callback) {
    callback = callback || display

    terminal.pause()

    $.jrpc(url, id, method, params, function(json) {
        if (!json.error) {
            callback.call(terminal, json.result)
        } else {
            terminal.error('&#91;RPC&#93; ' + json.error);
        }

        terminal.resume()
    }, function(xhr, status, error) {
        terminal.error('&#91;AJAX&#93; ' + status +
                       ' - Server reponse is: \n' +
                       xhr.responseText);

        terminal.resume()
    });
}

function make_endpoint(url, handle) {
    var id = 1;

    return function(line, terminal) {
        if (line === '') {
            return;
        }

        var args = parse(line)
        var command = args.shift()

        if(handle) {
            if(typeof handle !== 'object' && typeof handle !== 'function') {
                throw new Error('handle is not an object or an function')
            }

            if(typeof handle === 'object' && command in handle) {
                handle[command].apply(terminal, args)
                return
            } else if(typeof handle === 'function' && handle(command, args, terminal)) {
                return
            }
        }

        var token = terminal.token()
        
        if(token) {
            args = [token].concat(args)
        }

        var callback = display
        var at_command = '@' + command
        if(typeof handle === 'object' && at_command in handle) {
            callback = handle[at_command]
        }

        call_rpc(url, id++, command, args, terminal, callback)
    };
}

$(function() {
    var service_endpoint = {
        connect: function(current_endpoint) {
            this.echo('Press CTRL-D to exit from the service')

            var uri = URI(current_endpoint)
            var terminal = this

            this.push(make_endpoint(current_endpoint, {
                use: function(service) {
                    this.echo('Press CTRL-D to exit from the endpoint')

                    var new_endpoint = current_endpoint.replace(/\/+$/,'') + '/' + service + '-endpoint.php'

                    this.push(make_endpoint(new_endpoint), {
                        name: current_endpoint,
                        prompt: this.login_name() + '@' + uri.hostname() + '/' + service  + ' $ '
                    })

                },
                '@help': function(result) {
                    if(typeof result !== 'object') {
                        result = {}
                    }

                    result['use SERVICE'] = 'use specified SERVICE from a set of services available';

                    display.call(this, result)
                }
             }), {
                name: current_endpoint,
                prompt: function(commandline) {
                    commandline(terminal.login_name() + '@' + uri.hostname() + ' $ ')
                },
                login: function(user, password, callback) {
                    call_rpc(current_endpoint, id++, 'login', [user, password], $.terminal.active(), function(result) {
                        callback(result.token)
                    })
                },
            })
        }, help: function() {
            var help = {
                'connect SERVICE': 'connect to a specified SERVICE',
            }

            display.call(this, help)
        }
    }

    var id = 1

    $('#terminal').terminal(service_endpoint, {
        greetings: "Welcome to λδ Public Access Server. Type `help' to get more information."
    })
})
